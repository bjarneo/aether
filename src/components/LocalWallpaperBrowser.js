import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {favoritesService} from '../services/favorites-service.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {batchProcessingState} from '../state/BatchProcessingState.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
import {uploadWallpaper} from '../utils/wallpaper-utils.js';
import {applyCssToWidget, removeAllChildren} from '../utils/ui-helpers.js';
import {ConfigWriter} from '../utils/ConfigWriter.js';
import {restartSwaybg} from '../utils/service-manager.js';
import {DialogManager} from '../utils/DialogManager.js';
import {
    deleteFile,
    moveFile,
    getSubdirectories,
    getFileMetadata,
    ensureDirectoryExists,
    enumerateDirectoryAsync,
} from '../utils/file-utils.js';
import {
    createSectionHeader,
    createEmptyState,
    styleButton,
} from './ui/BrowserHeader.js';
import {SPACING, GRID} from '../constants/ui-constants.js';
import {SignalTracker} from '../utils/signal-tracker.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('LocalWallpaperBrowser');

// Grid size presets (thumbnail heights)
const GRID_SIZES = {
    small: 120,
    medium: 180,
    large: 260,
};

/**
 * Returns plural suffix 's' if count is not 1
 * @param {number} count
 * @returns {string}
 */
function plural(count) {
    return count === 1 ? '' : 's';
}

/**
 * LocalWallpaperBrowser - Enhanced component for browsing local wallpapers
 *
 * Features:
 * - Auto-discovers wallpapers from ~/Wallpapers directory and subdirectories
 * - Search by filename with real-time filtering
 * - Sort by name, date modified, or file size (ascending/descending)
 * - Grid size toggle (small/medium/large thumbnails)
 * - Multi-select mode with batch delete and batch favorite
 * - Context menu with Set as Wallpaper, Quick Preview, Rename, Move, Delete
 * - Subfolder support with collapsible expander sections
 * - Image dimensions overlay on thumbnails
 */
export const LocalWallpaperBrowser = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'favorites-changed': {},
            'add-to-additional-images': {param_types: [GObject.TYPE_JSOBJECT]},
            'process-batch-requested': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class LocalWallpaperBrowser extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            // Signal tracker for cleanup
            this._signals = new SignalTracker();

            this._wallpapersPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                'Wallpapers',
            ]);

            // State variables
            this._searchQuery = '';
            this._sortMode = 'name'; // 'name' | 'date' | 'size'
            this._sortOrder = 'asc'; // 'asc' | 'desc'
            this._gridSize = 'medium'; // 'small' | 'medium' | 'large'
            this._multiSelectMode = false;
            this._selectedWallpapers = new Set();
            this._wallpapers = []; // Root wallpapers
            this._subfolders = new Map(); // Map<folderName, wallpaper[]>
            this._cardCache = new Map(); // Map<path, {card, flowBoxChild}> for reordering
            this._subfolderExpanders = new Map(); // Map<folderName, expander> for reordering
            this._pendingThumbnails = new Set(); // Track pending thumbnail loads for cancellation

            this._initializeUI();

            // Initialize responsive grid manager
            this._gridManager = new ResponsiveGridManager(
                this._gridFlow,
                this._scrolledWindow,
                this
            );
            this._gridManager.initialize();

            this._loadWallpapersAsync();
        }

        /**
         * Called when widget is removed from the widget tree
         * Cleans up all signal connections and pending operations
         */
        vfunc_unroot() {
            this._signals.disconnectAll();
            this._pendingThumbnails.clear();
            super.vfunc_unroot();
        }

        _initializeUI() {
            // Section header
            const header = createSectionHeader(
                'Local Wallpapers',
                '~/Wallpapers'
            );
            this.append(header);

            // Toolbar
            const toolbar = this._createToolbar();
            this.append(toolbar);

            // Batch actions bar (hidden by default)
            this._batchActionsBar = this._createBatchActionsBar();
            this._batchActionsBar.set_visible(false);
            this.append(this._batchActionsBar);

            // Main content
            this._contentStack = new Gtk.Stack({
                vexpand: true,
                transition_type: Gtk.StackTransitionType.CROSSFADE,
            });

            // Loading state
            const loadingBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: SPACING.MD,
                margin_top: 48,
            });
            const spinner = new Gtk.Spinner({
                width_request: 32,
                height_request: 32,
            });
            spinner.start();
            const loadingLabel = new Gtk.Label({
                label: 'Scanning wallpapers...',
            });
            applyCssToWidget(
                loadingLabel,
                'label { font-size: 13px; opacity: 0.6; }'
            );
            loadingBox.append(spinner);
            loadingBox.append(loadingLabel);
            this._contentStack.add_named(loadingBox, 'loading');

            // Empty state
            const emptyState = createEmptyState({
                icon: 'folder-pictures-symbolic',
                title: 'No Wallpapers Found',
                description: 'Add images to ~/Wallpapers to browse them here',
            });
            this._contentStack.add_named(emptyState, 'empty');

            // Scrolled window for wallpaper grid
            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            // Main container for grid and subfolders
            this._mainContainer = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            // Wallpaper grid for root folder
            this._gridFlow = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: GRID.MAX_COLUMNS,
                min_children_per_line: GRID.MIN_COLUMNS,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                homogeneous: true,
            });

            this._mainContainer.append(this._gridFlow);
            this._scrolledWindow.set_child(this._mainContainer);
            this._contentStack.add_named(this._scrolledWindow, 'content');

            this._contentStack.set_visible_child_name('loading');
            this.append(this._contentStack);
        }

        _createToolbar() {
            const toolbarBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search wallpapers...',
                width_request: 200,
            });
            this._searchEntry.connect('search-changed', () => {
                this._filterWallpapers();
            });
            toolbarBox.append(this._searchEntry);

            // Sort dropdown
            const sortModel = Gtk.StringList.new(['Name', 'Date', 'Size']);
            this._sortDropdown = new Gtk.DropDown({
                model: sortModel,
                selected: 0,
                tooltip_text: 'Sort by',
            });
            applyCssToWidget(
                this._sortDropdown,
                'dropdown { min-width: 80px; }'
            );
            this._sortDropdown.connect('notify::selected', () => {
                const modes = ['name', 'date', 'size'];
                this._sortMode = modes[this._sortDropdown.get_selected()];
                this._applySortAndFilter();
            });
            toolbarBox.append(this._sortDropdown);

            // Sort order toggle button
            this._sortOrderButton = new Gtk.Button({
                icon_name: 'view-sort-ascending-symbolic',
                tooltip_text: 'Sort ascending',
            });
            styleButton(this._sortOrderButton, {flat: true});
            this._sortOrderButton.connect('clicked', () => {
                this._sortOrder = this._sortOrder === 'asc' ? 'desc' : 'asc';
                this._sortOrderButton.set_icon_name(
                    this._sortOrder === 'asc'
                        ? 'view-sort-ascending-symbolic'
                        : 'view-sort-descending-symbolic'
                );
                this._sortOrderButton.set_tooltip_text(
                    this._sortOrder === 'asc'
                        ? 'Sort ascending'
                        : 'Sort descending'
                );
                this._applySortAndFilter();
            });
            toolbarBox.append(this._sortOrderButton);

            // Spacer
            const spacer = new Gtk.Box({hexpand: true});
            toolbarBox.append(spacer);

            // Grid size toggle group
            const gridSizeBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                css_classes: ['linked'],
            });

            this._gridSizeButtons = {};
            const sizes = [
                {
                    key: 'small',
                    icon: 'view-grid-symbolic',
                    tooltip: 'Small thumbnails',
                },
                {
                    key: 'medium',
                    icon: 'view-app-grid-symbolic',
                    tooltip: 'Medium thumbnails',
                },
                {
                    key: 'large',
                    icon: 'view-dual-symbolic',
                    tooltip: 'Large thumbnails',
                },
            ];

            sizes.forEach(({key, icon, tooltip}) => {
                const btn = new Gtk.ToggleButton({
                    icon_name: icon,
                    tooltip_text: tooltip,
                    active: key === this._gridSize,
                });
                btn.connect('toggled', () => {
                    if (btn.get_active()) {
                        // Deactivate other buttons
                        Object.entries(this._gridSizeButtons).forEach(
                            ([k, b]) => {
                                if (k !== key) b.set_active(false);
                            }
                        );
                        this._gridSize = key;
                        this._updateGridSize();
                    }
                });
                this._gridSizeButtons[key] = btn;
                gridSizeBox.append(btn);
            });

            toolbarBox.append(gridSizeBox);

            // Multi-select toggle button
            this._multiSelectButton = new Gtk.ToggleButton({
                icon_name: 'selection-mode-symbolic',
                tooltip_text: 'Multi-select mode',
            });
            styleButton(this._multiSelectButton, {flat: true});
            this._multiSelectButton.connect('toggled', () => {
                this._multiSelectMode = this._multiSelectButton.get_active();
                this._selectedWallpapers.clear();
                this._updateMultiSelectUI();
                this._renderWallpapers();
            });
            toolbarBox.append(this._multiSelectButton);

            // Action buttons group
            const actionsBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 2,
            });
            applyCssToWidget(
                actionsBox,
                'box { background-color: alpha(@view_bg_color, 0.5); border: 1px solid alpha(@borders, 0.15); border-radius: 0; padding: 2px; }'
            );

            // Refresh button
            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh',
            });
            styleButton(refreshButton, {flat: true});
            refreshButton.connect('clicked', () => this._loadWallpapersAsync());
            actionsBox.append(refreshButton);

            // Open folder button
            const openFolderButton = new Gtk.Button({
                icon_name: 'folder-open-symbolic',
                tooltip_text: 'Open folder',
            });
            styleButton(openFolderButton, {flat: true});
            openFolderButton.connect('clicked', () => this._openFolder());
            actionsBox.append(openFolderButton);

            // Upload/Select wallpaper button
            const uploadButton = new Gtk.Button({
                icon_name: 'document-open-symbolic',
                tooltip_text: 'Select wallpaper',
            });
            styleButton(uploadButton, {flat: true});
            uploadButton.connect('clicked', () => this._selectWallpaper());
            actionsBox.append(uploadButton);

            toolbarBox.append(actionsBox);

            return toolbarBox;
        }

        _createBatchActionsBar() {
            const bar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_bottom: SPACING.SM,
            });

            applyCssToWidget(
                bar,
                'box { background-color: alpha(@accent_bg_color, 0.1); border: 1px solid alpha(@accent_bg_color, 0.3); padding: 8px 12px; border-radius: 0; }'
            );

            this._selectionCountLabel = new Gtk.Label({
                label: '0 selected',
                hexpand: true,
                xalign: 0,
            });
            bar.append(this._selectionCountLabel);

            // Batch favorite button
            const batchFavButton = new Gtk.Button({
                icon_name: 'emblem-favorite-symbolic',
                tooltip_text: 'Add selected to favorites',
            });
            styleButton(batchFavButton, {flat: true});
            batchFavButton.connect('clicked', () => this._batchFavorite());
            bar.append(batchFavButton);

            // Batch delete button
            const batchDeleteButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                tooltip_text: 'Delete selected',
                css_classes: ['destructive-action'],
            });
            batchDeleteButton.connect('clicked', () => this._batchDelete());
            bar.append(batchDeleteButton);

            // Process selected button (batch processing)
            this._processSelectedButton = new Gtk.Button({
                label: 'Process',
                icon_name: 'media-playback-start-symbolic',
                tooltip_text: 'Process selected wallpapers',
                css_classes: ['suggested-action'],
            });
            this._processSelectedButton.connect('clicked', () => this._processSelected());
            bar.append(this._processSelectedButton);

            return bar;
        }

        async _loadWallpapersAsync() {
            this._contentStack.set_visible_child_name('loading');
            this._wallpapers = [];
            this._subfolders.clear();
            this._cardCache.clear();
            this._subfolderExpanders.clear();
            removeAllChildren(this._gridFlow);

            const dir = Gio.File.new_for_path(this._wallpapersPath);

            // Check if directory exists
            if (!dir.query_exists(null)) {
                this._contentStack.set_visible_child_name('empty');
                return;
            }

            try {
                // Scan root directory
                this._wallpapers = await this._scanDirectory(
                    this._wallpapersPath,
                    null
                );

                // Scan subdirectories
                const subdirs = getSubdirectories(this._wallpapersPath);
                for (const subdir of subdirs) {
                    const subdirPath = GLib.build_filenamev([
                        this._wallpapersPath,
                        subdir,
                    ]);
                    const subdirWallpapers = await this._scanDirectory(
                        subdirPath,
                        subdir
                    );
                    if (subdirWallpapers.length > 0) {
                        this._subfolders.set(subdir, subdirWallpapers);
                    }
                }

                const totalCount =
                    this._wallpapers.length +
                    Array.from(this._subfolders.values()).reduce(
                        (sum, arr) => sum + arr.length,
                        0
                    );

                if (totalCount === 0) {
                    this._contentStack.set_visible_child_name('empty');
                    return;
                }

                this._applySortAndFilter();
                this._contentStack.set_visible_child_name('content');
            } catch (e) {
                log.error('Error loading local wallpapers', e);
                this._contentStack.set_visible_child_name('empty');
            }
        }

        async _scanDirectory(dirPath, folderName) {
            const wallpapers = [];
            try {
                // Use async directory enumeration with all needed attributes in one query
                const entries = await enumerateDirectoryAsync(
                    dirPath,
                    'standard::name,standard::type,standard::content-type,standard::size,time::modified'
                );

                for (const {fileInfo, filePath} of entries) {
                    const contentType = fileInfo.get_content_type();
                    if (contentType && contentType.startsWith('image/')) {
                        const file = Gio.File.new_for_path(filePath);
                        // Get size and modTime directly from fileInfo (already queried)
                        const size = fileInfo.get_size();
                        const modTime =
                            fileInfo.get_modification_date_time()?.to_unix() ||
                            0;
                        wallpapers.push({
                            name: fileInfo.get_name(),
                            file: file,
                            path: filePath,
                            folder: folderName,
                            modTime: modTime,
                            size: size,
                        });
                    }
                }
            } catch (e) {
                log.error(`Error scanning directory ${dirPath}`, e);
            }
            return wallpapers;
        }

        _applySortAndFilter() {
            // Sort root wallpapers
            this._sortWallpapers(this._wallpapers);

            // Sort each subfolder's wallpapers
            this._subfolders.forEach(wallpapers => {
                this._sortWallpapers(wallpapers);
            });

            this._renderWallpapers();
        }

        _sortWallpapers(wallpapers) {
            const comparators = {
                name: (a, b) => a.name.localeCompare(b.name),
                date: (a, b) => a.modTime - b.modTime,
                size: (a, b) => a.size - b.size,
            };
            const cmp = comparators[this._sortMode] || comparators.name;
            const dir = this._sortOrder === 'asc' ? 1 : -1;

            wallpapers.sort((a, b) => cmp(a, b) * dir);
        }

        async _renderWallpapers() {
            // Check if we can reorder existing cards (same wallpapers, just different order)
            const canReorder =
                this._cardCache.size > 0 &&
                this._wallpapers.every(wp => this._cardCache.has(wp.path));

            if (canReorder) {
                // Use FlowBox's built-in sort function for efficient reordering
                this._applySortFunction();
            } else {
                // Full rebuild needed (new wallpapers loaded or first render)
                await this._fullRebuildWallpapers();
            }

            // Reapply search filter
            if (this._searchQuery) {
                this._filterWallpapers();
            }
        }

        /**
         * Applies sort function to FlowBox for efficient reordering
         * Uses GTK's native sort mechanism instead of manual DOM manipulation
         * @private
         */
        _applySortFunction() {
            // Build a sort index map for O(1) lookups during comparison
            const sortIndex = new Map();
            this._wallpapers.forEach((wp, index) => {
                sortIndex.set(wp.path, index);
            });

            // Set sort function on FlowBox - GTK handles the reordering efficiently
            this._gridFlow.set_sort_func((child1, child2) => {
                const card1 = child1.get_child();
                const card2 = child2.get_child();
                const path1 = card1?._wallpaperPath;
                const path2 = card2?._wallpaperPath;

                const index1 = sortIndex.get(path1) ?? 0;
                const index2 = sortIndex.get(path2) ?? 0;

                return index1 - index2;
            });

            // Trigger the sort
            this._gridFlow.invalidate_sort();
        }

        /**
         * Full rebuild of wallpaper cards (used on initial load or grid size change)
         * @private
         */
        async _fullRebuildWallpapers() {
            // Clear sort function during rebuild
            this._gridFlow.set_sort_func(null);

            // Clear existing cards and cache
            removeAllChildren(this._gridFlow);
            this._cardCache.clear();

            // Clear subfolder expanders
            let child = this._mainContainer.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                if (child !== this._gridFlow) {
                    this._mainContainer.remove(child);
                }
                child = next;
            }
            this._subfolderExpanders.clear();

            // Render root wallpapers
            for (const wp of this._wallpapers) {
                await this._addWallpaperCardAsync(wp, this._gridFlow);
            }

            // Render subfolder sections
            for (const [folderName, wallpapers] of this._subfolders) {
                const expander = await this._createSubfolderExpander(
                    folderName,
                    wallpapers
                );
                this._subfolderExpanders.set(folderName, expander);
                this._mainContainer.append(expander);
            }
        }

        async _createSubfolderExpander(folderName, wallpapers) {
            const expander = new Gtk.Expander({
                label: `${folderName} (${wallpapers.length})`,
                expanded: false,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            // Custom header with folder icon
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });
            const folderIcon = new Gtk.Image({
                icon_name: 'folder-symbolic',
            });
            const headerLabel = new Gtk.Label({
                label: `${folderName} (${wallpapers.length})`,
            });
            headerBox.append(folderIcon);
            headerBox.append(headerLabel);
            expander.set_label_widget(headerBox);

            // Grid for subfolder wallpapers
            const subGrid = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: GRID.MAX_COLUMNS,
                min_children_per_line: GRID.MIN_COLUMNS,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.MD,
                homogeneous: true,
            });

            // Store reference for filtering
            subGrid._folderName = folderName;
            expander._subGrid = subGrid;

            // Lazy load wallpapers when expanded
            let loaded = false;
            expander.connect('notify::expanded', async () => {
                if (expander.get_expanded() && !loaded) {
                    loaded = true;
                    for (const wp of wallpapers) {
                        await this._addWallpaperCardAsync(wp, subGrid);
                    }
                }
            });

            expander.set_child(subGrid);
            return expander;
        }

        async _addWallpaperCardAsync(wallpaper, targetGrid) {
            const wallpaperData = {
                path: wallpaper.path,
                type: 'local',
                name: wallpaper.name,
                info: wallpaper.name,
                data: {
                    name: wallpaper.name,
                    folder: wallpaper.folder,
                },
            };

            const cardOptions = {
                showCheckbox: this._multiSelectMode,
                isSelected: this._selectedWallpapers.has(wallpaper.path),
                height: GRID_SIZES[this._gridSize],
                onContextMenu: (wp, widget, x, y) =>
                    this._showContextMenu(wp, widget, x, y),
                onCheckboxToggle: (wp, isChecked) => {
                    if (isChecked) {
                        this._selectedWallpapers.add(wp.path);
                    } else {
                        this._selectedWallpapers.delete(wp.path);
                    }
                    this._updateMultiSelectUI();
                },
            };

            const {mainBox, picture} = createWallpaperCard(
                wallpaperData,
                wp => this.emit('wallpaper-selected', wp.path),
                () => this.emit('favorites-changed'),
                wp => this.emit('add-to-additional-images', wallpaperData),
                cardOptions
            );

            // Store wallpaper data for filtering
            mainBox._wallpaperName = wallpaper.name.toLowerCase();
            mainBox._wallpaperPath = wallpaper.path;

            // Append to grid first so we can get the FlowBoxChild
            targetGrid.append(mainBox);

            // Cache the card and its FlowBoxChild parent for reordering
            const flowBoxChild = mainBox.get_parent();
            if (targetGrid === this._gridFlow) {
                this._cardCache.set(wallpaper.path, {
                    card: mainBox,
                    flowBoxChild,
                });
            }

            // Track this thumbnail load for cancellation on destroy
            const loadId = wallpaper.path;
            this._pendingThumbnails.add(loadId);

            // Load thumbnail asynchronously (non-blocking)
            thumbnailService.getThumbnail(wallpaper.file).then(thumbPath => {
                // Skip if component was destroyed or this load was cancelled
                if (!this._pendingThumbnails.has(loadId)) {
                    return;
                }
                this._pendingThumbnails.delete(loadId);

                if (thumbPath) {
                    try {
                        // Load at scaled size to reduce memory usage
                        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                            thumbPath,
                            GRID_SIZES[this._gridSize] * 2, // 2x for HiDPI
                            GRID_SIZES[this._gridSize] * 2,
                            true // preserve aspect ratio
                        );
                        const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                        picture.set_paintable(texture);
                    } catch (e) {
                        log.error('Failed to load thumbnail', e);
                        picture.set_file(wallpaper.file);
                    }
                } else {
                    picture.set_file(wallpaper.file);
                }
            });
        }

        _updateGridSize() {
            // Clear cache to force full rebuild with new card heights
            this._cardCache.clear();
            this._subfolderExpanders.clear();
            this._renderWallpapers();
        }

        _updateMultiSelectUI() {
            const count = this._selectedWallpapers.size;
            this._batchActionsBar.set_visible(
                this._multiSelectMode && count > 0
            );
            this._selectionCountLabel.set_label(`${count} selected`);
        }

        /**
         * Updates favorites when a wallpaper path changes (rename/move)
         * @param {string} oldPath - Original file path
         * @param {string} newPath - New file path
         * @param {string} newName - New file name
         */
        _updateFavoriteOnPathChange(oldPath, newPath, newName) {
            if (favoritesService.isFavorite(oldPath)) {
                favoritesService.removeFavorite(oldPath);
                favoritesService.addFavorite(newPath, 'local', {name: newName});
            }
        }

        _showContextMenu(wallpaper, widget, x, y) {
            const menu = Gio.Menu.new();
            menu.append('Set as Wallpaper', 'wallpaper.set');
            menu.append('Quick Preview', 'wallpaper.preview');
            menu.append('Add to Favorites', 'wallpaper.favorite');

            const section2 = Gio.Menu.new();
            section2.append('Move to Folder...', 'wallpaper.move');
            section2.append('Rename...', 'wallpaper.rename');
            menu.append_section(null, section2);

            const section3 = Gio.Menu.new();
            section3.append('Delete', 'wallpaper.delete');
            menu.append_section(null, section3);

            const popover = new Gtk.PopoverMenu({
                menu_model: menu,
                halign: Gtk.Align.START,
                has_arrow: false,
            });

            const actionGroup = Gio.SimpleActionGroup.new();

            // Helper to create and register actions
            const addAction = (name, handler) => {
                const action = Gio.SimpleAction.new(name, null);
                action.connect('activate', () => {
                    popover.popdown();
                    handler();
                });
                actionGroup.add_action(action);
            };

            addAction('set', () => this._setAsWallpaper(wallpaper));
            addAction('preview', () => this._showPreview(wallpaper));
            addAction('favorite', () => {
                favoritesService.addFavorite(wallpaper.path, 'local', {
                    name: wallpaper.name,
                });
                this.emit('favorites-changed');
            });
            addAction('move', () => this._showMoveDialog(wallpaper));
            addAction('rename', () => this._showRenameDialog(wallpaper));
            addAction('delete', () => this._confirmDelete(wallpaper));

            popover.insert_action_group('wallpaper', actionGroup);
            popover.set_parent(widget);
            popover.popup();
        }

        _setAsWallpaper(wallpaper) {
            const configWriter = new ConfigWriter();
            configWriter.applyWallpaper(wallpaper.path);
            restartSwaybg();
            DialogManager.showToast(this, {title: 'Wallpaper applied'});
        }

        _showPreview(wallpaper) {
            const dialog = new Adw.Dialog({
                title: wallpaper.name,
                content_width: 800,
                content_height: 600,
            });

            const toolbarView = new Adw.ToolbarView();
            const headerBar = new Adw.HeaderBar({show_title: true});
            toolbarView.add_top_bar(headerBar);

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            // Full-size image
            const picture = new Gtk.Picture({
                file: Gio.File.new_for_path(wallpaper.path),
                content_fit: Gtk.ContentFit.CONTAIN,
                vexpand: true,
                hexpand: true,
            });
            contentBox.append(picture);

            // Info row
            const infoBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_bottom: SPACING.MD,
                halign: Gtk.Align.CENTER,
            });

            // Load dimensions on-the-fly for preview
            try {
                const format = GdkPixbuf.Pixbuf.get_file_info(wallpaper.path);
                if (format && format[1] && format[2]) {
                    infoBox.append(
                        new Gtk.Label({
                            label: `Resolution: ${format[1]}x${format[2]}`,
                        })
                    );
                }
            } catch (e) {
                // Ignore dimension loading errors
            }

            const sizeKB = Math.round(wallpaper.size / 1024);
            const sizeStr =
                sizeKB > 1024
                    ? `${(sizeKB / 1024).toFixed(1)} MB`
                    : `${sizeKB} KB`;
            infoBox.append(new Gtk.Label({label: `Size: ${sizeStr}`}));

            contentBox.append(infoBox);

            toolbarView.set_content(contentBox);
            dialog.set_child(toolbarView);
            dialog.present(this.get_root());
        }

        _showRenameDialog(wallpaper) {
            const dialogManager = new DialogManager(this.get_root());
            const currentName = wallpaper.name;
            const extension = currentName.includes('.')
                ? '.' + currentName.split('.').pop()
                : '';
            const baseName = currentName.replace(extension, '');

            dialogManager.showTextInput({
                heading: 'Rename Wallpaper',
                body: 'Enter a new name for this wallpaper',
                placeholder: baseName,
                defaultValue: baseName,
                onSubmit: newName => {
                    if (!newName || newName === baseName) return;

                    const newFileName = newName + extension;
                    const dir = GLib.path_get_dirname(wallpaper.path);
                    const newPath = GLib.build_filenamev([dir, newFileName]);

                    if (moveFile(wallpaper.path, newPath)) {
                        this._updateFavoriteOnPathChange(
                            wallpaper.path,
                            newPath,
                            newFileName
                        );
                        this._loadWallpapersAsync();
                        DialogManager.showToast(this, {
                            title: 'Wallpaper renamed',
                        });
                    }
                },
            });
        }

        _showMoveDialog(wallpaper) {
            const dialog = new Adw.Dialog({
                title: 'Move to Folder',
                content_width: 300,
                content_height: 400,
            });

            const toolbarView = new Adw.ToolbarView();
            const headerBar = new Adw.HeaderBar({show_title: true});
            toolbarView.add_top_bar(headerBar);

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
            });

            const label = new Gtk.Label({
                label: 'Select destination folder:',
                xalign: 0,
            });
            contentBox.append(label);

            // List of existing folders
            const listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.SINGLE,
                css_classes: ['boxed-list'],
            });

            // Root folder option
            const rootRow = new Adw.ActionRow({
                title: 'Root (~/Wallpapers)',
                icon_name: 'folder-symbolic',
            });
            rootRow._folderPath = this._wallpapersPath;
            listBox.append(rootRow);

            // Existing subfolders
            const subdirs = getSubdirectories(this._wallpapersPath);
            for (const subdir of subdirs) {
                const row = new Adw.ActionRow({
                    title: subdir,
                    icon_name: 'folder-symbolic',
                });
                row._folderPath = GLib.build_filenamev([
                    this._wallpapersPath,
                    subdir,
                ]);
                listBox.append(row);
            }

            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });
            scrolled.set_child(listBox);
            contentBox.append(scrolled);

            // New folder entry
            const newFolderBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });
            const newFolderEntry = new Gtk.Entry({
                placeholder_text: 'New folder name...',
                hexpand: true,
            });
            const createFolderBtn = new Gtk.Button({
                icon_name: 'folder-new-symbolic',
                tooltip_text: 'Create folder',
            });
            createFolderBtn.connect('clicked', () => {
                const name = newFolderEntry.get_text().trim();
                if (name) {
                    const newPath = GLib.build_filenamev([
                        this._wallpapersPath,
                        name,
                    ]);
                    ensureDirectoryExists(newPath);
                    // Add new row
                    const row = new Adw.ActionRow({
                        title: name,
                        icon_name: 'folder-symbolic',
                    });
                    row._folderPath = newPath;
                    listBox.append(row);
                    listBox.select_row(row);
                    newFolderEntry.set_text('');
                }
            });
            newFolderBox.append(newFolderEntry);
            newFolderBox.append(createFolderBtn);
            contentBox.append(newFolderBox);

            // Move button
            const moveBtn = new Gtk.Button({
                label: 'Move',
                css_classes: ['suggested-action'],
                margin_top: SPACING.MD,
            });
            moveBtn.connect('clicked', () => {
                const selectedRow = listBox.get_selected_row();
                if (!selectedRow) return;

                const destDir = selectedRow._folderPath;
                const fileName = GLib.path_get_basename(wallpaper.path);
                const newPath = GLib.build_filenamev([destDir, fileName]);

                if (wallpaper.path === newPath) {
                    dialog.close();
                    return;
                }

                if (moveFile(wallpaper.path, newPath)) {
                    this._updateFavoriteOnPathChange(
                        wallpaper.path,
                        newPath,
                        fileName
                    );
                    dialog.close();
                    this._loadWallpapersAsync();
                    DialogManager.showToast(this, {title: 'Wallpaper moved'});
                }
            });
            contentBox.append(moveBtn);

            toolbarView.set_content(contentBox);
            dialog.set_child(toolbarView);
            dialog.present(this.get_root());
        }

        _confirmDelete(wallpaper) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showConfirmation({
                heading: 'Delete Wallpaper',
                body: `Are you sure you want to delete "${wallpaper.name}"?\n\nThis action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                onConfirm: () => {
                    if (deleteFile(wallpaper.path)) {
                        // Remove from favorites if needed
                        if (favoritesService.isFavorite(wallpaper.path)) {
                            favoritesService.removeFavorite(wallpaper.path);
                            this.emit('favorites-changed');
                        }
                        this._loadWallpapersAsync();
                        DialogManager.showToast(this, {
                            title: 'Wallpaper deleted',
                        });
                    }
                },
            });
        }

        _batchDelete() {
            if (this._selectedWallpapers.size === 0) return;

            const count = this._selectedWallpapers.size;
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showConfirmation({
                heading: 'Delete Wallpapers',
                body: `Are you sure you want to delete ${count} wallpaper${plural(count)}?\n\nThis action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                onConfirm: () => {
                    let deleted = 0;
                    for (const path of this._selectedWallpapers) {
                        if (deleteFile(path)) {
                            if (favoritesService.isFavorite(path)) {
                                favoritesService.removeFavorite(path);
                            }
                            deleted++;
                        }
                    }
                    this._selectedWallpapers.clear();
                    this._updateMultiSelectUI();
                    this.emit('favorites-changed');
                    this._loadWallpapersAsync();
                    DialogManager.showToast(this, {
                        title: `${deleted} wallpaper${plural(deleted)} deleted`,
                    });
                },
            });
        }

        _batchFavorite() {
            if (this._selectedWallpapers.size === 0) return;

            let added = 0;
            for (const path of this._selectedWallpapers) {
                if (!favoritesService.isFavorite(path)) {
                    const name = GLib.path_get_basename(path);
                    favoritesService.addFavorite(path, 'local', {name});
                    added++;
                }
            }
            this.emit('favorites-changed');
            DialogManager.showToast(this, {
                title: `${added} wallpaper${plural(added)} added to favorites`,
            });
        }

        /**
         * Process selected wallpapers for batch theme generation
         * @private
         */
        _processSelected() {
            if (this._selectedWallpapers.size === 0) return;

            // Build wallpaper data array
            const wallpapers = [];
            for (const path of this._selectedWallpapers) {
                const name = GLib.path_get_basename(path);
                wallpapers.push({
                    path: path,
                    type: 'local',
                    name: name,
                    data: {name},
                });
            }

            // Exit multi-select mode
            this._multiSelectMode = false;
            this._multiSelectButton.set_active(false);
            this._selectedWallpapers.clear();
            this._updateMultiSelectUI();
            this._renderWallpapers();

            // Emit signal for batch processing
            this.emit('process-batch-requested', wallpapers);
        }

        _openFolder() {
            const launcher = new Gtk.FileLauncher({
                file: Gio.File.new_for_path(this._wallpapersPath),
            });

            launcher.open_containing_folder(
                this.get_root(),
                null,
                (source, result) => {
                    try {
                        launcher.open_containing_folder_finish(result);
                    } catch (e) {
                        log.error('Error opening folder', e);
                    }
                }
            );
        }

        _selectWallpaper() {
            uploadWallpaper(this.get_root(), destPath => {
                this._loadWallpapersAsync();
                this.emit('wallpaper-selected', destPath);
            });
        }

        _filterWallpapers() {
            const query = this._searchEntry.get_text().toLowerCase().trim();
            this._searchQuery = query;

            // Filter root grid
            this._filterFlowBox(this._gridFlow, query);

            // Filter subfolders
            let child = this._mainContainer.get_first_child();
            while (child) {
                if (child instanceof Gtk.Expander && child._subGrid) {
                    this._filterFlowBox(child._subGrid, query);
                }
                child = child.get_next_sibling();
            }
        }

        _filterFlowBox(flowBox, query) {
            let child = flowBox.get_first_child();
            while (child) {
                const card = child.get_child();
                const name = card?._wallpaperName || '';
                const visible = !query || name.includes(query);
                child.set_visible(visible);
                child = child.get_next_sibling();
            }
        }
    }
);
