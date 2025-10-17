import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import cairo from 'gi://cairo';

import {applyCssToWidget} from '../utils/ui-helpers.js';

/**
 * WallpaperEditor - Apply CSS filters to wallpapers (like web browsers!)
 * 
 * Uses GTK CSS filters for instant real-time preview, then applies via GdkPixbuf for export
 */
export const WallpaperEditor = GObject.registerClass(
    {
        Signals: {
            'wallpaper-applied': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperEditor extends Gtk.Box {
        _init(wallpaperPath) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._wallpaperPath = wallpaperPath;

            // Filter values (CSS-style: 100% = normal)
            this._filters = {
                blur: 0,          // 0-10px
                brightness: 100,  // 0-200%
                contrast: 100,    // 0-200%
                saturation: 100,  // 0-200%
            };

            this._initializeUI();
            this._loadWallpaper();
        }

        _initializeUI() {
            // Header
            const headerBar = new Adw.HeaderBar({
                show_title: false,
            });

            const titleLabel = new Gtk.Label({
                label: 'Wallpaper Editor',
                css_classes: ['title-3'],
            });
            headerBar.set_title_widget(titleLabel);

            // Apply button with spinner (right side)
            const applyBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            this._applySpinner = new Gtk.Spinner({
                width_request: 16,
                height_request: 16,
                visible: false,
            });

            this._applyButton = new Gtk.Button({
                label: 'Apply',
                tooltip_text: 'Apply filters and return to palette editor',
                css_classes: ['suggested-action'],
            });
            this._applyButton.connect('clicked', () => this._applyWallpaper());

            applyBox.append(this._applySpinner);
            applyBox.append(this._applyButton);
            headerBar.pack_end(applyBox);

            this.append(headerBar);

            // Main content - side by side
            const paned = new Gtk.Paned({
                orientation: Gtk.Orientation.HORIZONTAL,
                shrink_start_child: false,
                shrink_end_child: false,
                resize_start_child: true,
                resize_end_child: false,
                hexpand: true,
                vexpand: true,
                position: 500,
            });

            // Left: Preview
            paned.set_start_child(this._createPreviewArea());

            // Right: Controls
            paned.set_end_child(this._createControlsArea());

            const mainBox = new Gtk.Box({
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
                hexpand: true,
                vexpand: true,
            });
            mainBox.append(paned);

            this.append(mainBox);
        }

        _createPreviewArea() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                hexpand: true,
                vexpand: true,
            });

            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_bottom: 6,
            });

            const label = new Gtk.Label({
                label: 'Preview',
                css_classes: ['title-4'],
                xalign: 0,
                hexpand: true,
            });

            const infoLabel = new Gtk.Label({
                label: 'Real-time CSS filters',
                css_classes: ['dim-label', 'caption'],
                xalign: 1,
            });

            headerBox.append(label);
            headerBox.append(infoLabel);
            box.append(headerBox);

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                hexpand: true,
                vexpand: true,
            });

            this._previewPicture = new Gtk.Picture({
                can_shrink: true,
                content_fit: Gtk.ContentFit.CONTAIN,
            });

            scrolled.set_child(this._previewPicture);

            const frame = new Gtk.Frame({
                css_classes: ['card'],
                child: scrolled,
            });
            box.append(frame);

            return box;
        }

        _createControlsArea() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                width_request: 340,
            });

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 18,
                margin_top: 6,
                margin_bottom: 6,
            });

            // Filters group
            const group = new Adw.PreferencesGroup({
                title: 'Filters',
                description: 'Adjust to create the desired mood',
            });

            // Blur
            group.add(
                this._createSliderRow(
                    'Blur',
                    'blur',
                    0,
                    10,
                    0.5,
                    0,
                    'px',
                    'Soften the image'
                )
            );

            // Brightness
            group.add(
                this._createSliderRow(
                    'Brightness',
                    'brightness',
                    50,
                    150,
                    1,
                    100,
                    '%',
                    'Lighten or darken'
                )
            );

            // Contrast
            group.add(
                this._createSliderRow(
                    'Contrast',
                    'contrast',
                    50,
                    150,
                    1,
                    100,
                    '%',
                    'Adjust contrast'
                )
            );

            // Saturation
            group.add(
                this._createSliderRow(
                    'Saturation',
                    'saturation',
                    0,
                    150,
                    1,
                    100,
                    '%',
                    '0% = grayscale'
                )
            );

            contentBox.append(group);

            // Reset button at bottom of filters
            const resetRow = new Adw.ActionRow({
                title: 'Reset All Filters',
            });

            const resetButton = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Reset all filters to default',
            });
            resetButton.connect('clicked', () => this._resetFilters());
            resetRow.add_suffix(resetButton);

            const resetGroup = new Adw.PreferencesGroup();
            resetGroup.add(resetRow);
            contentBox.append(resetGroup);

            // Quick presets group
            const presetsGroup = new Adw.PreferencesGroup({
                title: 'Quick Presets',
                description: 'Common filter combinations',
            });

            const presetsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            const presets = [
                {name: 'Muted', blur: 0, brightness: 95, contrast: 85, saturation: 60},
                {name: 'Dramatic', blur: 0, brightness: 90, contrast: 130, saturation: 110},
                {name: 'Soft', blur: 0, brightness: 105, contrast: 85, saturation: 90},
                {name: 'Vintage', blur: 0, brightness: 95, contrast: 110, saturation: 70},
            ];

            const presetButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                homogeneous: true,
            });

            presets.forEach(preset => {
                const btn = new Gtk.Button({
                    label: preset.name,
                    hexpand: true,
                });
                btn.connect('clicked', () => this._applyPreset(preset));
                presetButtonBox.append(btn);
            });

            presetsBox.append(presetButtonBox);
            presetsGroup.add(new Adw.ActionRow({child: presetsBox}));
            contentBox.append(presetsGroup);

            scrolled.set_child(contentBox);
            box.append(scrolled);

            return box;
        }

        _createSliderRow(title, key, min, max, step, defaultValue, unit, subtitle) {
            const row = new Adw.ActionRow({
                title: title,
                subtitle: subtitle || '',
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 6,
                margin_end: 6,
            });

            const scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                draw_value: false,
                hexpand: true,
                width_request: 180,
            });
            scale.set_range(min, max);
            scale.set_increments(step, step * 5);
            scale.set_value(defaultValue);

            const valueLabel = new Gtk.Label({
                label: `${Math.round(defaultValue)}${unit}`,
                width_chars: 7,
                xalign: 1,
                css_classes: ['monospace', 'dim-label'],
            });

            scale.connect('value-changed', () => {
                const value = scale.get_value();
                this._filters[key] = value;
                valueLabel.set_label(`${Math.round(value)}${unit}`);
                this._updatePreviewCss();
            });

            box.append(scale);
            box.append(valueLabel);
            row.add_suffix(box);

            // Store for reset
            if (!this._sliders) this._sliders = {};
            this._sliders[key] = {scale, valueLabel, defaultValue, unit};

            return row;
        }

        _applyPreset(preset) {
            Object.keys(preset).forEach(key => {
                if (key !== 'name' && this._sliders[key]) {
                    const value = preset[key];
                    this._filters[key] = value;
                    this._sliders[key].scale.set_value(value);
                    this._sliders[key].valueLabel.set_label(
                        `${Math.round(value)}${this._sliders[key].unit}`
                    );
                }
            });
            this._updatePreviewCss();
        }

        _updatePreviewCss() {
            this._applyCssFiltersTo(this._previewPicture);
        }

        _loadWallpaper() {
            try {
                const file = Gio.File.new_for_path(this._wallpaperPath);
                this._previewPicture.set_file(file);
                this._updatePreviewCss();
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        _resetFilters() {
            Object.keys(this._sliders).forEach(key => {
                const {scale, valueLabel, defaultValue, unit} = this._sliders[key];
                this._filters[key] = defaultValue;
                scale.set_value(defaultValue);
                valueLabel.set_label(`${Math.round(defaultValue)}${unit}`);
            });
            this._updatePreviewCss();
        }

        async _applyWallpaper() {
            // Show spinner, hide button
            this._applyButton.set_visible(false);
            this._applySpinner.set_visible(true);
            this._applySpinner.start();

            try {
                // Check if any filters are active
                const hasFilters = this._filters.blur > 0 ||
                                   this._filters.brightness !== 100 ||
                                   this._filters.contrast !== 100 ||
                                   this._filters.saturation !== 100;

                if (!hasFilters) {
                    // No filters applied, just return original
                    this.emit('wallpaper-applied', this._wallpaperPath);
                    return;
                }

                const processedPath = await this._saveProcessedWallpaper();
                this.emit('wallpaper-applied', processedPath);
            } catch (e) {
                console.error('Failed to apply wallpaper:', e.message);
            } finally {
                // Reset button state
                this._applySpinner.stop();
                this._applySpinner.set_visible(false);
                this._applyButton.set_visible(true);
            }
        }

        async _saveProcessedWallpaper() {
            console.log('Applying filters:', JSON.stringify(this._filters));

            // Check if any filters are active
            const hasFilters = this._filters.blur > 0 ||
                               this._filters.brightness !== 100 ||
                               this._filters.contrast !== 100 ||
                               this._filters.saturation !== 100;

            if (!hasFilters) {
                console.log('No filters to apply, using original');
                return this._wallpaperPath;
            }

            const cacheDir = GLib.build_filenamev([
                GLib.get_user_cache_dir(),
                'aether',
            ]);
            GLib.mkdir_with_parents(cacheDir, 0o755);

            const tempPath = GLib.build_filenamev([
                cacheDir,
                'processed-wallpaper.png',
            ]);

            // Build ImageMagick command
            const args = ['convert', this._wallpaperPath];

            // Apply modulate for brightness and saturation
            const brightnessPercent = this._filters.brightness;
            const saturationPercent = this._filters.saturation;
            
            if (brightnessPercent !== 100 || saturationPercent !== 100) {
                args.push('-modulate', `${brightnessPercent},${saturationPercent},100`);
            }

            // Apply contrast
            if (this._filters.contrast !== 100) {
                const contrastFactor = (this._filters.contrast / 100) - 1;
                if (contrastFactor > 0) {
                    args.push('-sigmoidal-contrast', `${3 + contrastFactor * 7}x50%`);
                } else if (contrastFactor < 0) {
                    args.push('+sigmoidal-contrast', `${3 + Math.abs(contrastFactor) * 7}x50%`);
                }
            }

            // Apply blur
            if (this._filters.blur > 0) {
                args.push('-blur', `0x${this._filters.blur}`);
            }

            args.push(tempPath);

            console.log('Running ImageMagick:', args.join(' '));

            return new Promise((resolve, reject) => {
                try {
                    const proc = Gio.Subprocess.new(
                        args,
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );

                    // Wait asynchronously
                    proc.wait_async(null, (source, result) => {
                        try {
                            source.wait_finish(result);
                            const exitCode = source.get_exit_status();

                            if (exitCode !== 0) {
                                const stderr = source.get_stderr_pipe();
                                if (stderr) {
                                    const stream = new Gio.DataInputStream({base_stream: stderr});
                                    const [line] = stream.read_line_utf8(null);
                                    reject(new Error(`ImageMagick error: ${line}`));
                                    return;
                                }
                                reject(new Error('ImageMagick failed'));
                                return;
                            }

                            console.log('Saved successfully to:', tempPath);
                            resolve(tempPath);
                        } catch (e) {
                            reject(e);
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }

        _applyCssFiltersTo(widget) {
            // Build CSS filter string (same as preview)
            const filters = [];

            if (this._filters.blur > 0) {
                filters.push(`blur(${this._filters.blur}px)`);
            }
            if (this._filters.brightness !== 100) {
                filters.push(`brightness(${this._filters.brightness / 100})`);
            }
            if (this._filters.contrast !== 100) {
                filters.push(`contrast(${this._filters.contrast / 100})`);
            }
            if (this._filters.saturation !== 100) {
                filters.push(`saturate(${this._filters.saturation / 100})`);
            }

            const filterString = filters.length > 0 ? filters.join(' ') : 'none';
            const css = `* { filter: ${filterString}; }`;
            applyCssToWidget(widget, css);
        }
    }
);
