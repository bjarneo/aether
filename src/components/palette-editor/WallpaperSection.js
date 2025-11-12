import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {uploadWallpaper} from '../../utils/wallpaper-utils.js';

/**
 * WallpaperSection - Handles wallpaper preview, upload, and actions
 * Displays the main wallpaper with Extract, Edit, and Apply buttons
 */
export const WallpaperSection = GObject.registerClass(
    {
        Signals: {
            'extract-clicked': {param_types: [GObject.TYPE_STRING]}, // Passes extraction mode
            'edit-clicked': {},
            'apply-clicked': {},
            'wallpaper-loaded': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperSection extends Adw.PreferencesGroup {
        _init() {
            super._init({
                visible: false, // Hidden until wallpaper is loaded
            });

            this._currentWallpaper = null;
            this._spinner = null;

            this._buildUI();
        }

        _buildUI() {
            const wallpaperRow = new Adw.ActionRow({
                title: 'Wallpaper',
                subtitle: 'Select, edit, and extract colors from an image',
            });

            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

            // Extract button with dropdown menu
            const extractMenu = Gio.Menu.new();
            extractMenu.append('Extract', 'wallpaper.extract-normal');
            extractMenu.append(
                'Monochromatic',
                'wallpaper.extract-monochromatic'
            );
            extractMenu.append('Analogous', 'wallpaper.extract-analogous');
            extractMenu.append('Pastel', 'wallpaper.extract-pastel');
            extractMenu.append('Material', 'wallpaper.extract-material');

            const extractMenuButton = new Gtk.MenuButton({
                icon_name: 'color-select-symbolic',
                label: 'Extract',
                menu_model: extractMenu,
                css_classes: ['suggested-action'],
                tooltip_text: 'Extract colors from wallpaper (choose mode)',
            });

            // Create action group for menu items
            this._actionGroup = Gio.SimpleActionGroup.new();

            // Helper function to create extraction action
            const createExtractionAction = (name, mode) => {
                const action = Gio.SimpleAction.new(name, null);
                action.connect('activate', () => {
                    this.emit('extract-clicked', mode);
                });
                this._actionGroup.add_action(action);
            };

            // Add extraction mode actions
            createExtractionAction('extract-normal', 'normal');
            createExtractionAction('extract-monochromatic', 'monochromatic');
            createExtractionAction('extract-analogous', 'analogous');
            createExtractionAction('extract-pastel', 'pastel');
            createExtractionAction('extract-material', 'material');

            this.insert_action_group('wallpaper', this._actionGroup);

            buttonBox.append(extractMenuButton);

            // Edit button
            const editButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            editButtonBox.append(
                new Gtk.Image({
                    icon_name: 'image-edit-symbolic',
                })
            );
            editButtonBox.append(
                new Gtk.Label({
                    label: 'Edit',
                })
            );

            this._editWallpaperBtn = new Gtk.Button({
                child: editButtonBox,
                tooltip_text:
                    'Edit wallpaper (apply filters before extraction)',
            });
            this._editWallpaperBtn.connect('clicked', () =>
                this.emit('edit-clicked')
            );
            buttonBox.append(this._editWallpaperBtn);

            // Apply wallpaper button
            const applyWallpaperButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            applyWallpaperButtonBox.append(
                new Gtk.Image({
                    icon_name: 'wallpaper-symbolic',
                })
            );
            applyWallpaperButtonBox.append(
                new Gtk.Label({
                    label: 'Apply',
                })
            );

            this._applyWallpaperBtn = new Gtk.Button({
                child: applyWallpaperButtonBox,
                tooltip_text: 'Apply wallpaper to the desktop',
            });
            this._applyWallpaperBtn.connect('clicked', () =>
                this.emit('apply-clicked')
            );
            buttonBox.append(this._applyWallpaperBtn);

            // Loading spinner
            this._spinner = new Gtk.Spinner({
                width_request: 24,
                height_request: 24,
                valign: Gtk.Align.CENTER,
                visible: false,
            });
            buttonBox.append(this._spinner);

            wallpaperRow.add_suffix(buttonBox);
            this.add(wallpaperRow);

            // Wallpaper preview
            this._wallpaperPreview = new Gtk.Picture({
                height_request: 350,
                can_shrink: true,
                content_fit: Gtk.ContentFit.CONTAIN,
                css_classes: ['card'],
                hexpand: true,
                visible: false,
            });
            this.add(this._wallpaperPreview);
        }

        loadWallpaper(path) {
            this._currentWallpaper = path;
            this.set_visible(true);

            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                this._wallpaperPreview.set_paintable(texture);
                this._wallpaperPreview.set_visible(true);
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
                const file = Gio.File.new_for_path(path);
                this._wallpaperPreview.set_file(file);
                this._wallpaperPreview.set_visible(true);
            }

            this.emit('wallpaper-loaded', path);
        }

        getCurrentWallpaper() {
            return this._currentWallpaper;
        }

        setLoading(loading) {
            this._spinner.set_visible(loading);
            if (loading) {
                this._spinner.start();
            } else {
                this._spinner.stop();
            }
        }

        reset() {
            this._currentWallpaper = null;
            this._wallpaperPreview.set_file(null);
            this._wallpaperPreview.set_visible(false);
            this.set_visible(false);
            this.setLoading(false);
        }
    }
);
