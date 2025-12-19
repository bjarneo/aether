import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {favoritesService} from '../services/favorites-service.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
import {uploadWallpaper} from '../utils/wallpaper-utils.js';
import {SPACING, GRID} from '../constants/ui-constants.js';

/**
 * LocalWallpaperBrowser - Component for browsing local wallpapers from ~/Wallpapers
 *
 * Provides a grid view interface for discovering and selecting wallpapers from
 * the user's local ~/Wallpapers directory. Automatically generates thumbnails
 * for fast browsing and integrates with the favorites system for quick access
 * to preferred wallpapers.
 *
 * Features:
 * - Auto-discovers wallpapers from ~/Wallpapers directory
 * - Async thumbnail generation via thumbnailService (cached for performance)
 * - Grid layout with responsive FlowBox (2-3 columns)
 * - Favorites integration with star button on each card
 * - Refresh button to rescan directory for new wallpapers
 * - Open folder button to launch file manager
 * - File picker button for selecting wallpapers outside ~/Wallpapers
 * - Three UI states: loading (spinner), empty (no wallpapers), content (grid)
 * - Drag-and-drop support for wallpaper selection
 *
 * Wallpaper Discovery:
 * - Scans ~/Wallpapers for image files (jpg, jpeg, png, webp)
 * - Uses Gio.File.enumerate_children with MIME type filtering
 * - Sorts wallpapers alphabetically by filename
 * - Async loading prevents UI freezing on large directories
 *
 * Thumbnail System:
 * - Generates thumbnails via thumbnailService.generateThumbnail()
 * - Cached in ~/.cache/aether/thumbnails/ for instant reloading
 * - Async thumbnail loading (loads one card at a time)
 * - Falls back to placeholder icon if thumbnail fails
 *
 * Favorites Integration:
 * - Star icon button on each wallpaper card
 * - Add/remove from favorites via favoritesService
 * - Emits 'favorites-changed' signal on star/unstar
 * - Favorites persist in ~/.config/aether/favorites.json
 *
 * UI Structure:
 * - Gtk.Box (vertical) container
 * - Toolbar with Refresh, Open Folder, and File Picker buttons
 * - Gtk.Stack for state management (loading, empty, content)
 * - Gtk.ScrolledWindow with Gtk.FlowBox for grid layout
 * - WallpaperCard components for each wallpaper
 *
 * Signals:
 * - 'wallpaper-selected': (path: string) - Emitted when wallpaper is clicked
 *   - path is absolute file path to the wallpaper
 * - 'favorites-changed': () - Emitted when favorites are modified
 *   - No parameters, indicates favorites need to be refreshed
 * - 'add-to-additional-images': (wallpaper: object) - Emitted when adding to additional images
 *
 * Empty State:
 * - Shown when ~/Wallpapers doesn't exist or is empty
 * - Displays folder icon and helpful message
 * - Suggests creating ~/Wallpapers directory
 *
 * @example
 * const browser = new LocalWallpaperBrowser();
 * browser.connect('wallpaper-selected', (widget, path) => {
 *     console.log(`Selected: ${path}`);
 *     loadWallpaper(path);
 * });
 * browser.connect('favorites-changed', () => {
 *     refreshFavoritesView();
 * });
 */
export const LocalWallpaperBrowser = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'favorites-changed': {},
            'add-to-additional-images': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class LocalWallpaperBrowser extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            this._wallpapersPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                'Wallpapers',
            ]);

            this._initializeUI();

            // Initialize responsive grid manager (same as WallhavenBrowser)
            this._gridManager = new ResponsiveGridManager(
                this._gridFlow,
                this._scrolledWindow,
                this
            );
            this._gridManager.initialize();

            this._loadWallpapersAsync();
        }

        _initializeUI() {
            // Toolbar
            const toolbar = this._createToolbar();
            this.append(toolbar);

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
            });
            const spinner = new Gtk.Spinner({
                width_request: 48,
                height_request: 48,
            });
            spinner.start();
            const loadingLabel = new Gtk.Label({
                label: 'Loading wallpapers...',
                css_classes: ['dim-label'],
            });
            loadingBox.append(spinner);
            loadingBox.append(loadingLabel);
            this._contentStack.add_named(loadingBox, 'loading');

            // Empty state
            const emptyBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: SPACING.MD,
            });
            const emptyIcon = new Gtk.Image({
                icon_name: 'folder-symbolic',
                pixel_size: 64,
                css_classes: ['dim-label'],
            });
            const emptyLabel = new Gtk.Label({
                label: `No wallpapers found in ~/Wallpapers`,
                css_classes: ['dim-label', 'title-3'],
            });
            const emptyHint = new Gtk.Label({
                label: 'Add images to ~/Wallpapers to browse them here',
                css_classes: ['dim-label', 'caption'],
            });
            emptyBox.append(emptyIcon);
            emptyBox.append(emptyLabel);
            emptyBox.append(emptyHint);
            this._contentStack.add_named(emptyBox, 'empty');

            // Scrolled window for wallpaper grid
            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            // Wallpaper grid
            this._gridFlow = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: GRID.MAX_COLUMNS,
                min_children_per_line: GRID.MIN_COLUMNS,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                homogeneous: true,
            });

            this._scrolledWindow.set_child(this._gridFlow);
            this._contentStack.add_named(this._scrolledWindow, 'content');

            this._contentStack.set_visible_child_name('loading');
            this.append(this._contentStack);
        }

        _createToolbar() {
            const toolbarBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            // Path label
            const pathLabel = new Gtk.Label({
                label: '~/Wallpapers',
                css_classes: ['dim-label'],
                hexpand: true,
                xalign: 0,
            });
            toolbarBox.append(pathLabel);

            // Refresh button
            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh',
            });
            refreshButton.connect('clicked', () => this._loadWallpapersAsync());
            toolbarBox.append(refreshButton);

            // Open folder button
            const openFolderButton = new Gtk.Button({
                icon_name: 'folder-open-symbolic',
                tooltip_text: 'Open folder',
            });
            openFolderButton.connect('clicked', () => this._openFolder());
            toolbarBox.append(openFolderButton);

            // Upload/Select wallpaper button
            const uploadButton = new Gtk.Button({
                icon_name: 'upload-symbolic',
                tooltip_text: 'Upload wallpaper',
            });
            uploadButton.connect('clicked', () => this._selectWallpaper());
            toolbarBox.append(uploadButton);

            return toolbarBox;
        }

        async _loadWallpapersAsync() {
            this._contentStack.set_visible_child_name('loading');

            // Clear existing items
            let child = this._gridFlow.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._gridFlow.remove(child);
                child = next;
            }

            const dir = Gio.File.new_for_path(this._wallpapersPath);

            // Check if directory exists
            if (!dir.query_exists(null)) {
                this._contentStack.set_visible_child_name('empty');
                return;
            }

            try {
                const enumerator = dir.enumerate_children(
                    'standard::*',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                const wallpapers = [];
                let info;
                while ((info = enumerator.next_file(null))) {
                    const contentType = info.get_content_type();
                    if (contentType && contentType.startsWith('image/')) {
                        const file = dir.get_child(info.get_name());
                        wallpapers.push({
                            name: info.get_name(),
                            file: file,
                            path: file.get_path(),
                        });
                    }
                }

                if (wallpapers.length === 0) {
                    this._contentStack.set_visible_child_name('empty');
                    return;
                }

                // Sort by name
                wallpapers.sort((a, b) => a.name.localeCompare(b.name));

                // Load wallpapers asynchronously with thumbnails
                for (const wp of wallpapers) {
                    await this._addWallpaperCardAsync(wp);
                }

                this._contentStack.set_visible_child_name('content');
            } catch (e) {
                console.error('Error loading local wallpapers:', e.message);
                this._contentStack.set_visible_child_name('empty');
            }
        }

        async _addWallpaperCardAsync(wallpaper) {
            const wallpaperData = {
                path: wallpaper.path,
                type: 'local',
                name: wallpaper.name,
                info: wallpaper.name,
                data: {
                    name: wallpaper.name,
                },
            };

            const {mainBox, picture} = createWallpaperCard(
                wallpaperData,
                wp => this.emit('wallpaper-selected', wp.path),
                () => this.emit('favorites-changed'),
                wp => this.emit('add-to-additional-images', wallpaperData)
            );

            // Load thumbnail asynchronously using shared service
            const thumbPath = await thumbnailService.getThumbnail(
                wallpaper.file
            );
            if (thumbPath) {
                try {
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(thumbPath);
                    const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                    picture.set_paintable(texture);
                } catch (e) {
                    console.error('Failed to load thumbnail:', e.message);
                    picture.set_file(wallpaper.file);
                }
            } else {
                picture.set_file(wallpaper.file);
            }

            this._gridFlow.append(mainBox);
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
                        console.error('Error opening folder:', e.message);
                    }
                }
            );
        }

        _selectWallpaper() {
            uploadWallpaper(this.get_root(), destPath => {
                // Refresh the browser to show the new wallpaper
                this._loadWallpapersAsync();

                // Emit signal with the new path in ~/Wallpapers
                this.emit('wallpaper-selected', destPath);
            });
        }
    }
);
