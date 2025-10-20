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
import {uploadWallpaper} from '../utils/wallpaper-utils.js';

export const LocalWallpaperBrowser = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'favorites-changed': {},
        },
    },
    class LocalWallpaperBrowser extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            this._wallpapersPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                'Wallpapers',
            ]);

            this._initializeUI();
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
                spacing: 12,
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
                spacing: 12,
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
                max_children_per_line: 3,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 12,
                row_spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
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
                spacing: 6,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
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
                () => this.emit('favorites-changed')
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
