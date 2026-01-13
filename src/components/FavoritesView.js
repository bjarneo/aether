import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {favoritesService} from '../services/favorites-service.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
import {wallhavenService} from '../services/wallhaven-service.js';
import {
    createSectionHeader,
    createEmptyState,
} from './ui/BrowserHeader.js';
import {SPACING, GRID} from '../constants/ui-constants.js';

export const FavoritesView = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'add-to-additional-images': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class FavoritesView extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

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
                wp => this.emit('add-to-additional-images', wallpaper)
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
    }
);
