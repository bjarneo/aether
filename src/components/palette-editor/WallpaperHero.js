import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {uploadWallpaper} from '../../utils/wallpaper-utils.js';
import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {themeState} from '../../state/ThemeState.js';

/**
 * WallpaperHero - Prominent wallpaper display with elegant actions
 * Features a dramatic preview with overlaid controls
 */
export const WallpaperHero = GObject.registerClass(
    {
        Signals: {
            'extract-clicked': {param_types: [GObject.TYPE_STRING]},
            'edit-clicked': {},
            'apply-clicked': {},
            'wallpaper-loaded': {param_types: [GObject.TYPE_STRING]},
            'change-wallpaper': {},
        },
    },
    class WallpaperHero extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                visible: false,
            });

            this._currentWallpaper = themeState.getWallpaper();
            this._selectedMode = 'normal';
            this._isLoading = false;

            this._buildUI();
            this._connectThemeState();
        }

        _connectThemeState() {
            themeState.connect('wallpaper-changed', (_, wallpaperPath) => {
                if (wallpaperPath && wallpaperPath !== this._currentWallpaper) {
                    this.loadWallpaper(wallpaperPath);
                }
            });

            themeState.connect('state-reset', () => {
                this._currentWallpaper = null;
                this.set_visible(false);
            });
        }

        _buildUI() {
            // Main container
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
            });

            // Header row with title and change button
            const headerRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_bottom: 8,
            });

            const titleBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 2,
                hexpand: true,
            });

            const title = new Gtk.Label({
                label: 'Wallpaper',
                xalign: 0,
                css_classes: ['heading'],
            });
            applyCssToWidget(
                title,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.7;
                }
            `
            );
            titleBox.append(title);

            this._filenameLabel = new Gtk.Label({
                label: '',
                xalign: 0,
                css_classes: ['dim-label'],
                ellipsize: 3, // PANGO_ELLIPSIZE_END
            });
            applyCssToWidget(
                this._filenameLabel,
                `
                label {
                    font-size: 11px;
                    opacity: 0.5;
                }
            `
            );
            titleBox.append(this._filenameLabel);

            headerRow.append(titleBox);

            // Change wallpaper button
            const changeBtn = new Gtk.Button({
                label: 'Change',
                css_classes: ['flat'],
            });
            applyCssToWidget(
                changeBtn,
                `
                button {
                    padding: 4px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    border-radius: 0;
                }
            `
            );
            changeBtn.connect('clicked', () => this._changeWallpaper());
            headerRow.append(changeBtn);

            container.append(headerRow);

            // Preview container with overlay
            const previewOverlay = new Gtk.Overlay();

            // Wallpaper preview
            this._preview = new Gtk.Picture({
                height_request: 280,
                can_shrink: true,
                content_fit: Gtk.ContentFit.COVER,
                hexpand: true,
            });
            applyCssToWidget(
                this._preview,
                `
                picture {
                    border-radius: 0;
                    background-color: @view_bg_color;
                }
            `
            );
            previewOverlay.set_child(this._preview);

            // Action buttons overlay (bottom)
            const actionsOverlay = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.END,
                margin_bottom: 16,
                margin_start: 16,
                margin_end: 16,
            });
            applyCssToWidget(
                actionsOverlay,
                `
                box {
                    background-color: alpha(@window_bg_color, 0.9);
                    padding: 8px 12px;
                    border-radius: 0;
                }
            `
            );

            // Extract button (primary)
            this._extractBtn = new Gtk.Button({
                css_classes: ['suggested-action'],
            });
            const extractContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            extractContent.append(
                new Gtk.Image({icon_name: 'color-select-symbolic'})
            );
            extractContent.append(new Gtk.Label({label: 'Extract Colors'}));
            this._extractBtn.set_child(extractContent);
            applyCssToWidget(
                this._extractBtn,
                `
                button {
                    padding: 8px 16px;
                    font-weight: 600;
                    border-radius: 0;
                }
            `
            );
            this._extractBtn.connect('clicked', () => {
                this.emit('extract-clicked', this._selectedMode);
            });
            actionsOverlay.append(this._extractBtn);

            // Edit button
            const editBtn = new Gtk.Button({
                css_classes: ['flat'],
            });
            const editContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            editContent.append(
                new Gtk.Image({icon_name: 'image-edit-symbolic'})
            );
            editContent.append(new Gtk.Label({label: 'Edit'}));
            editBtn.set_child(editContent);
            applyCssToWidget(
                editBtn,
                `
                button {
                    padding: 8px 12px;
                    border-radius: 0;
                    color: @window_fg_color;
                }
                button:hover {
                    background-color: alpha(@window_fg_color, 0.1);
                }
            `
            );
            editBtn.connect('clicked', () => this.emit('edit-clicked'));
            actionsOverlay.append(editBtn);

            // Apply wallpaper button
            const applyBtn = new Gtk.Button({
                css_classes: ['flat'],
            });
            const applyContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            applyContent.append(
                new Gtk.Image({icon_name: 'wallpaper-symbolic'})
            );
            applyContent.append(new Gtk.Label({label: 'Set Wallpaper'}));
            applyBtn.set_child(applyContent);
            applyCssToWidget(
                applyBtn,
                `
                button {
                    padding: 8px 12px;
                    border-radius: 0;
                    color: @window_fg_color;
                }
                button:hover {
                    background-color: alpha(@window_fg_color, 0.1);
                }
            `
            );
            applyBtn.connect('clicked', () => this.emit('apply-clicked'));
            actionsOverlay.append(applyBtn);

            // Loading spinner
            this._spinner = new Gtk.Spinner({
                width_request: 24,
                height_request: 24,
                visible: false,
            });
            actionsOverlay.append(this._spinner);

            previewOverlay.add_overlay(actionsOverlay);

            container.append(previewOverlay);

            // Extraction mode row
            const modeRow = this._createModeSelector();
            container.append(modeRow);

            this.append(container);
        }

        _createModeSelector() {
            const row = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 12,
            });

            const label = new Gtk.Label({
                label: 'Extraction Mode',
                xalign: 0,
                hexpand: true,
            });
            applyCssToWidget(
                label,
                `
                label {
                    font-size: 13px;
                    font-weight: 500;
                    opacity: 0.8;
                }
            `
            );
            row.append(label);

            // Mode dropdown
            const modeDropdown = new Gtk.DropDown({
                valign: Gtk.Align.CENTER,
            });

            const modeModel = Gtk.StringList.new([
                'Auto-detect',
                'Monochromatic',
                'Analogous',
                'Pastel',
                'Material',
                'Colorful',
                'Muted',
                'Bright',
            ]);
            modeDropdown.set_model(modeModel);
            modeDropdown.set_selected(0);

            applyCssToWidget(
                modeDropdown,
                `
                dropdown {
                    border-radius: 0;
                }
                dropdown > button {
                    border-radius: 0;
                    padding: 4px 12px;
                }
            `
            );

            this._modeNames = [
                'normal',
                'monochromatic',
                'analogous',
                'pastel',
                'material',
                'colorful',
                'muted',
                'bright',
            ];

            modeDropdown.connect('notify::selected', () => {
                const selected = modeDropdown.get_selected();
                this._selectedMode = this._modeNames[selected];
            });

            row.append(modeDropdown);

            return row;
        }

        _changeWallpaper() {
            uploadWallpaper(this.get_root(), path => {
                if (path) {
                    this.loadWallpaper(path);
                    this.emit('change-wallpaper');
                }
            });
        }

        loadWallpaper(path) {
            this._currentWallpaper = path;
            this.set_visible(true);

            // Update filename label
            const filename = GLib.path_get_basename(path);
            this._filenameLabel.set_label(filename);

            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                this._preview.set_paintable(texture);
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
                const file = Gio.File.new_for_path(path);
                this._preview.set_file(file);
            }

            this.emit('wallpaper-loaded', path);
        }

        getCurrentWallpaper() {
            return this._currentWallpaper;
        }

        setLoading(loading) {
            this._isLoading = loading;
            this._spinner.set_visible(loading);
            this._extractBtn.set_sensitive(!loading);

            if (loading) {
                this._spinner.start();
            } else {
                this._spinner.stop();
            }
        }

        reset() {
            this._currentWallpaper = null;
            this._preview.set_paintable(null);
            this._filenameLabel.set_label('');
            this.set_visible(false);
            this.setLoading(false);
        }
    }
);
