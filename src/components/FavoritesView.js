import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {favoritesService} from '../services/favorites-service.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {wallhavenService} from '../services/wallhaven-service.js';
import {batchProcessingState} from '../state/BatchProcessingState.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {
    styleButton,
    createSectionHeader,
    createEmptyState,
} from './ui/BrowserHeader.js';
import {applyCssToWidget, removeAllChildren} from '../utils/ui-helpers.js';
import {ensureDirectoryExists} from '../utils/file-utils.js';
import {DialogManager} from '../utils/DialogManager.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
import {SPACING, GRID} from '../constants/ui-constants.js';

export const FavoritesView = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'add-to-additional-images': {param_types: [GObject.TYPE_JSOBJECT]},
            'process-batch-requested': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class FavoritesView extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            // Selection mode state
            this._multiSelectMode = false;
            this._selectedWallpapers = new Set();

            this._initializeUI();

            // Initialize responsive grid manager (same as WallhavenBrowser)
            this._gridManager = new ResponsiveGridManager(
                this._gridFlow,
                this._scrolledWindow,
                this
            );
            this._gridManager.initialize();

            // Load favorites when view becomes visible
            this.connect('map', () => {
                this.loadFavorites();
            });
        }

        _initializeUI() {
            // Section header
            const header = createSectionHeader(
                'Favorites',
                'Your saved wallpapers'
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

            // Empty state
            const emptyState = createEmptyState({
                icon: 'emblem-favorite-symbolic',
                title: 'No Favorites Yet',
                description:
                    'Click the heart icon on wallpapers to add them here',
            });
            this._contentStack.add_named(emptyState, 'empty');

            // Scrolled window for favorites grid
            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            // Favorites grid
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

            this._scrolledWindow.set_child(this._gridFlow);
            this._contentStack.add_named(this._scrolledWindow, 'content');

            this.append(this._contentStack);
        }

        async loadFavorites() {
            // Clear existing items
            let child = this._gridFlow.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._gridFlow.remove(child);
                child = next;
            }

            const favorites = favoritesService.getFavorites();

            if (favorites.length === 0) {
                this._contentStack.set_visible_child_name('empty');
                return;
            }

            // Sort by path (since we don't have timestamps in old format)
            favorites.sort((a, b) => b.path.localeCompare(a.path));

            // Load favorites
            for (const fav of favorites) {
                await this._addFavoriteCard(fav);
            }

            this._contentStack.set_visible_child_name('content');
        }

        async _addFavoriteCard(favorite) {
            const wallpaper = {
                path: favorite.path,
                type: favorite.type,
                data: favorite.data,
            };

            if (favorite.type === 'local') {
                wallpaper.name =
                    favorite.data.name || GLib.path_get_basename(favorite.path);
                wallpaper.info = wallpaper.name;
            } else if (favorite.type === 'wallhaven') {
                wallpaper.info = `${favorite.data.resolution || ''} • ${this._formatFileSize(favorite.data.file_size || 0)}`;

                // Check if wallhaven image is already downloaded to permanent storage
                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);
                GLib.mkdir_with_parents(wallpapersDir, 0o755);

                const filename = favorite.path.split('/').pop();
                const wallpaperPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);
                const file = Gio.File.new_for_path(wallpaperPath);

                // If already downloaded, update path to local file
                if (file.query_exists(null)) {
                    wallpaper.localPath = wallpaperPath;
                }
            }

            // Options for selection mode
            const cardOptions = {
                showCheckbox: this._multiSelectMode,
                isSelected: this._selectedWallpapers.has(favorite.path),
                onCheckboxToggle: (wp, isChecked) => {
                    this._onCheckboxToggle(favorite.path, isChecked);
                },
            };

            const {mainBox, picture} = createWallpaperCard(
                wallpaper,
                async wp => {
                    // For wallhaven, download if needed before selecting
                    if (wp.type === 'wallhaven') {
                        const localPath =
                            await this._ensureWallhavenDownloaded(wp);
                        if (localPath) {
                            this.emit('wallpaper-selected', localPath);
                        }
                    } else {
                        this.emit('wallpaper-selected', wp.path);
                    }
                },
                () => this.loadFavorites(), // Reload when unfavorited
                wp => this.emit('add-to-additional-images', wallpaper),
                cardOptions
            );

            // Load thumbnail
            await this._loadThumbnail(favorite, picture);

            this._gridFlow.append(mainBox);
        }

        async _ensureWallhavenDownloaded(wallpaper) {
            try {
                // Check if already downloaded
                if (wallpaper.localPath) {
                    return wallpaper.localPath;
                }

                // Use permanent data directory instead of cache
                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);
                GLib.mkdir_with_parents(wallpapersDir, 0o755);

                const filename = wallpaper.path.split('/').pop();
                const wallpaperPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);
                const file = Gio.File.new_for_path(wallpaperPath);

                // Download if not exists
                if (!file.query_exists(null)) {
                    console.log(
                        'Downloading wallhaven wallpaper:',
                        wallpaper.path
                    );
                    await wallhavenService.downloadWallpaper(
                        wallpaper.path,
                        wallpaperPath
                    );
                }

                return wallpaperPath;
            } catch (e) {
                console.error(
                    'Failed to download wallhaven wallpaper:',
                    e.message
                );
                return null;
            }
        }

        async _loadThumbnail(favorite, picture) {
            if (favorite.type === 'local') {
                const file = Gio.File.new_for_path(favorite.path);
                const thumbPath = await thumbnailService.getThumbnail(file);
                if (thumbPath) {
                    try {
                        const pixbuf =
                            GdkPixbuf.Pixbuf.new_from_file(thumbPath);
                        const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                        picture.set_paintable(texture);
                    } catch (e) {
                        console.error('Failed to load thumbnail:', e.message);
                        picture.set_file(file);
                    }
                } else {
                    picture.set_file(file);
                }
            } else if (
                favorite.type === 'wallhaven' &&
                favorite.data.thumbUrl
            ) {
                try {
                    const cacheDir = GLib.build_filenamev([
                        GLib.get_user_cache_dir(),
                        'aether',
                        'wallhaven-thumbs',
                    ]);
                    GLib.mkdir_with_parents(cacheDir, 0o755);

                    const filename = favorite.data.thumbUrl.split('/').pop();
                    const cachePath = GLib.build_filenamev([
                        cacheDir,
                        filename,
                    ]);

                    const file = Gio.File.new_for_path(cachePath);
                    if (file.query_exists(null)) {
                        picture.set_file(file);
                    } else {
                        await wallhavenService.downloadWallpaper(
                            favorite.data.thumbUrl,
                            cachePath
                        );
                        picture.set_file(Gio.File.new_for_path(cachePath));
                    }
                } catch (e) {
                    console.error(
                        'Failed to load wallhaven thumbnail:',
                        e.message
                    );
                }
            }
        }

        _formatFileSize(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }

        // ==================== Selection Mode ====================

        /**
         * Creates the toolbar with selection mode toggle
         * @returns {Gtk.Box} Toolbar widget
         * @private
         */
        _createToolbar() {
            const toolbar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_bottom: SPACING.SM,
            });

            // Spacer
            const spacer = new Gtk.Box({hexpand: true});
            toolbar.append(spacer);

            // Selection mode toggle button
            this._multiSelectButton = new Gtk.ToggleButton({
                icon_name: 'selection-mode-symbolic',
                tooltip_text: 'Selection Mode',
            });
            styleButton(this._multiSelectButton, {flat: true});
            this._multiSelectButton.connect('toggled', () => {
                this._multiSelectMode = this._multiSelectButton.get_active();
                this._selectedWallpapers.clear();
                this._updateMultiSelectUI();
                this.loadFavorites();
            });
            toolbar.append(this._multiSelectButton);

            return toolbar;
        }

        /**
         * Creates the batch actions bar
         * @returns {Gtk.Box} Batch actions bar widget
         * @private
         */
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

            // Remove from favorites button
            const removeButton = new Gtk.Button({
                icon_name: 'list-remove-symbolic',
                tooltip_text: 'Remove from favorites',
            });
            styleButton(removeButton, {flat: true});
            removeButton.connect('clicked', () => this._batchRemove());
            bar.append(removeButton);

            // Process selected button
            this._processSelectedButton = new Gtk.Button({
                label: 'Process',
                icon_name: 'media-playback-start-symbolic',
                tooltip_text: 'Process selected wallpapers',
                css_classes: ['suggested-action'],
            });
            this._processSelectedButton.connect('clicked', () =>
                this._processSelected()
            );
            bar.append(this._processSelectedButton);

            return bar;
        }

        /**
         * Update selection mode UI
         * @private
         */
        _updateMultiSelectUI() {
            const count = this._selectedWallpapers.size;
            this._batchActionsBar.set_visible(
                this._multiSelectMode && count > 0
            );
            this._selectionCountLabel.set_label(`${count} selected`);
        }

        /**
         * Handle checkbox toggle
         * @param {string} path - Wallpaper path
         * @param {boolean} isChecked - Whether checked
         * @private
         */
        _onCheckboxToggle(path, isChecked) {
            if (isChecked) {
                this._selectedWallpapers.add(path);
            } else {
                this._selectedWallpapers.delete(path);
            }
            this._updateMultiSelectUI();
        }

        /**
         * Remove selected wallpapers from favorites
         * @private
         */
        _batchRemove() {
            if (this._selectedWallpapers.size === 0) return;

            let removed = 0;
            for (const path of this._selectedWallpapers) {
                if (favoritesService.removeFavorite(path)) {
                    removed++;
                }
            }

            this._selectedWallpapers.clear();
            this._updateMultiSelectUI();
            this.loadFavorites();

            const plural = removed !== 1 ? 's' : '';
            DialogManager.showToast(this, {
                title: `${removed} wallpaper${plural} removed`,
            });
        }

        /**
         * Process selected wallpapers for batch theme generation
         * @private
         */
        async _processSelected() {
            if (this._selectedWallpapers.size === 0) return;

            const favorites = favoritesService.getFavorites();
            const selectedFavorites = favorites.filter(f =>
                this._selectedWallpapers.has(f.path)
            );

            const wallpapers = [];
            const wallpapersDir = GLib.build_filenamev([
                GLib.get_user_data_dir(),
                'aether',
                'wallpapers',
            ]);
            ensureDirectoryExists(wallpapersDir);

            for (const fav of selectedFavorites) {
                const localPath = await this._resolveWallpaperPath(
                    fav,
                    wallpapersDir
                );
                if (localPath) {
                    wallpapers.push({
                        path: localPath,
                        type: fav.type,
                        name:
                            fav.data?.name ||
                            fav.data?.id ||
                            GLib.path_get_basename(localPath),
                        data: fav.data,
                        originalPath:
                            fav.type === 'wallhaven' ? fav.path : undefined,
                    });
                }
            }

            if (wallpapers.length === 0) {
                DialogManager.showToast(this, {
                    title: 'No valid wallpapers to process',
                });
                return;
            }

            // Exit selection mode and emit
            this._multiSelectMode = false;
            this._multiSelectButton.set_active(false);
            this._selectedWallpapers.clear();
            this._updateMultiSelectUI();
            this.loadFavorites();
            this.emit('process-batch-requested', wallpapers);
        }

        /**
         * Resolve wallpaper to local path, downloading if needed
         * @private
         * @param {Object} favorite - Favorite data
         * @param {string} wallpapersDir - Directory for wallhaven downloads
         * @returns {Promise<string|null>} Local path or null if unavailable
         */
        async _resolveWallpaperPath(favorite, wallpapersDir) {
            if (favorite.type === 'local') {
                const file = Gio.File.new_for_path(favorite.path);
                return file.query_exists(null) ? favorite.path : null;
            }

            if (favorite.type === 'wallhaven') {
                const filename = favorite.path.split('/').pop();
                const localPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);
                const file = Gio.File.new_for_path(localPath);

                if (!file.query_exists(null)) {
                    try {
                        await wallhavenService.downloadWallpaper(
                            favorite.path,
                            localPath
                        );
                    } catch (e) {
                        console.error(
                            `Failed to download ${favorite.path}:`,
                            e.message
                        );
                        return null;
                    }
                }
                return localPath;
            }

            return null;
        }
    }
);
