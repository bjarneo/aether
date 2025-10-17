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
                hueRotate: 0,     // 0-360 degrees
                sepia: 0,         // 0-100%
                invert: 0,        // 0-100%
                tone: null,       // tone type (blue, red, etc.) or null
                toneAmount: 0,    // 0-100%
            };

            this._initializeUI();
            this._loadWallpaper();
        }

        _initializeUI() {
            // Header without HeaderBar background
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 18,
                margin_bottom: 12,
                margin_start: 18,
                margin_end: 18,
            });

            const titleLabel = new Gtk.Label({
                label: 'Wallpaper Editor',
                css_classes: ['title-3'],
                xalign: 0,
                hexpand: true,
            });
            headerBox.append(titleLabel);

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
            headerBox.append(applyBox);

            this.append(headerBox);

            // Main content - side by side
            const paned = new Gtk.Paned({
                orientation: Gtk.Orientation.HORIZONTAL,
                shrink_start_child: false,
                shrink_end_child: false,
                resize_start_child: true,
                resize_end_child: false,
                hexpand: true,
                vexpand: true,
                position: 650,
                margin_top: 0,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 6,
            });

            // Left: Preview
            paned.set_start_child(this._createPreviewArea());

            // Right: Controls
            paned.set_end_child(this._createControlsArea());

            const mainBox = new Gtk.Box({
                margin_top: 0,
                margin_bottom: 0,
                margin_start: 0,
                margin_end: 0,
                hexpand: true,
                vexpand: true,
            });
            mainBox.append(paned);

            this.append(mainBox);
        }

        _createPreviewArea() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 18,
                hexpand: true,
                vexpand: true,
                margin_start: 6,
                margin_end: 18,
            });

            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_bottom: 0,
            });

            const label = new Gtk.Label({
                label: 'Preview',
                css_classes: ['title-3'],
                xalign: 0,
                hexpand: true,
            });

            headerBox.append(label);
            box.append(headerBox);

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                hexpand: true,
                vexpand: true,
                margin_top: 0,
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
                width_request: 360,
            });

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                margin_top: 12,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
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

            // Hue rotation
            group.add(
                this._createSliderRow(
                    'Hue Shift',
                    'hueRotate',
                    0,
                    360,
                    1,
                    0,
                    '°',
                    'Rotate colors around the color wheel'
                )
            );

            contentBox.append(group);

            // Effects group
            const effectsGroup = new Adw.PreferencesGroup({
                title: 'Effects',
                description: 'Additional creative filters',
            });

            // Sepia
            effectsGroup.add(
                this._createSliderRow(
                    'Sepia',
                    'sepia',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Classic vintage brown tone'
                )
            );

            // Invert
            effectsGroup.add(
                this._createSliderRow(
                    'Invert',
                    'invert',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Invert colors'
                )
            );

            contentBox.append(effectsGroup);

            // Color tone group
            const toneGroup = new Adw.PreferencesGroup({
                title: 'Color Tone',
                description: 'Apply a color tone to the image',
            });

            // Tone selector with color buttons
            const toneRow = new Adw.ActionRow({
                title: 'Tone Preset',
            });

            const toneGrid = this._createToneGrid();
            toneRow.add_suffix(toneGrid);
            toneGroup.add(toneRow);

            // Tone amount slider
            toneGroup.add(
                this._createSliderRow(
                    'Tone Strength',
                    'toneAmount',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Intensity of color tone'
                )
            );

            contentBox.append(toneGroup);

            // Quick presets group
            const presetsGroup = new Adw.PreferencesGroup({
                title: 'Quick Presets',
                description: 'Common filter combinations',
            });

            const presetsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
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
                spacing: 8,
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

            // Reset button at bottom
            const resetRow = new Adw.ActionRow({
                title: 'Reset All Filters',
                subtitle: 'Return to original image',
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
                spacing: 16,
                margin_top: 14,
                margin_bottom: 14,
                margin_start: 8,
                margin_end: 8,
            });

            const scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                draw_value: false,
                hexpand: true,
                width_request: 200,
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

        _createToneGrid() {
            const tones = [
                {name: 'Blue', hue: 210, color: '#3b82f6'},
                {name: 'Cyan', hue: 180, color: '#06b6d4'},
                {name: 'Green', hue: 120, color: '#22c55e'},
                {name: 'Yellow', hue: 50, color: '#eab308'},
                {name: 'Orange', hue: 30, color: '#f97316'},
                {name: 'Red', hue: 0, color: '#ef4444'},
                {name: 'Pink', hue: 330, color: '#ec4899'},
                {name: 'Purple', hue: 270, color: '#a855f7'},
            ];

            const grid = new Gtk.FlowBox({
                max_children_per_line: 4,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 8,
                row_spacing: 8,
                margin_top: 8,
                margin_bottom: 8,
            });

            tones.forEach(tone => {
                const button = new Gtk.Button({
                    width_request: 52,
                    height_request: 36,
                    tooltip_text: `${tone.name} tone`,
                });

                // Style the button with the color
                const css = `* { 
                    background: ${tone.color}; 
                    border: 2px solid alpha(white, 0.2);
                    min-width: 52px;
                    min-height: 36px;
                }
                *:hover { 
                    border: 2px solid white;
                    transform: scale(1.05);
                }`;
                applyCssToWidget(button, css);

                button.connect('clicked', () => {
                    this._filters.tone = tone.hue;
                    // Auto-set amount to 30% if it's 0
                    if (this._filters.toneAmount === 0) {
                        this._filters.toneAmount = 30;
                        if (this._sliders['toneAmount']) {
                            this._sliders['toneAmount'].scale.set_value(30);
                            this._sliders['toneAmount'].valueLabel.set_label('30%');
                        }
                    }
                    this._updatePreviewCss();
                });

                grid.append(button);
            });

            // Clear button
            const clearButton = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                width_request: 52,
                height_request: 36,
                tooltip_text: 'Clear tone',
            });
            clearButton.connect('clicked', () => {
                this._filters.tone = null;
                this._filters.toneAmount = 0;
                if (this._sliders['toneAmount']) {
                    this._sliders['toneAmount'].scale.set_value(0);
                    this._sliders['toneAmount'].valueLabel.set_label('0%');
                }
                this._updatePreviewCss();
            });
            grid.append(clearButton);

            return grid;
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
                                   this._filters.saturation !== 100 ||
                                   this._filters.hueRotate !== 0 ||
                                   this._filters.sepia > 0 ||
                                   this._filters.invert > 0 ||
                                   (this._filters.tone !== null && this._filters.toneAmount > 0);

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
                               this._filters.saturation !== 100 ||
                               this._filters.hueRotate !== 0 ||
                               this._filters.sepia > 0 ||
                               this._filters.invert > 0 ||
                               (this._filters.tone !== null && this._filters.toneAmount > 0);

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

            // Apply hue rotation (modulate hue component)
            if (this._filters.hueRotate !== 0) {
                // ImageMagick hue is 0-200, CSS is 0-360
                const hue = 100 + (this._filters.hueRotate / 360) * 200;
                args.push('-modulate', `100,100,${hue}`);
            }

            // Apply sepia using color matrix (matches CSS sepia filter)
            if (this._filters.sepia > 0) {
                const amount = this._filters.sepia / 100;
                
                // CSS sepia matrix values
                const s = amount;
                const sepiaMatrix = `${0.393 * s + (1 - s)} ${0.769 * s} ${0.189 * s} ${0.349 * s} ${0.686 * s + (1 - s)} ${0.168 * s} ${0.272 * s} ${0.534 * s} ${0.131 * s + (1 - s)}`;
                
                args.push('-color-matrix', sepiaMatrix);
            }

            // Apply invert
            if (this._filters.invert > 0) {
                if (this._filters.invert >= 50) {
                    args.push('-negate');
                }
            }

            // Apply color tone
            // Match CSS: sepia(x) + hue-rotate(y) + saturate(z)
            if (this._filters.tone !== null && this._filters.toneAmount > 0) {
                const amount = this._filters.toneAmount;
                
                // Step 1: Convert to sepia (matches CSS sepia filter)
                // Sepia matrix in ImageMagick
                const sepiaMatrix = '0.393 0.769 0.189 0.349 0.686 0.168 0.272 0.534 0.131';
                
                // Apply sepia effect with blending based on amount
                if (amount < 100) {
                    // Partial sepia: blend original with sepia
                    args.push('(', '+clone', '-color-matrix', sepiaMatrix, ')');
                    args.push('-compose', 'blend', '-define', `compose:args=${amount}`, '-composite');
                } else {
                    // Full sepia
                    args.push('-color-matrix', sepiaMatrix);
                }
                
                // Step 2: Hue rotate (matches CSS hue-rotate)
                const sepiaHue = 38;
                const hueDiff = this._filters.tone - sepiaHue;
                const hueRadians = (hueDiff * Math.PI) / 180;
                const cosA = Math.cos(hueRadians);
                const sinA = Math.sin(hueRadians);
                
                const m00 = 0.213 + cosA * 0.787 - sinA * 0.213;
                const m01 = 0.715 - cosA * 0.715 - sinA * 0.715;
                const m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
                const m10 = 0.213 - cosA * 0.213 + sinA * 0.143;
                const m11 = 0.715 + cosA * 0.285 + sinA * 0.140;
                const m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
                const m20 = 0.213 - cosA * 0.213 - sinA * 0.787;
                const m21 = 0.715 - cosA * 0.715 + sinA * 0.715;
                const m22 = 0.072 + cosA * 0.928 + sinA * 0.072;
                
                args.push('-color-matrix', 
                    `${m00} ${m01} ${m02} ${m10} ${m11} ${m12} ${m20} ${m21} ${m22}`
                );
                
                // Step 3: Saturate (matches CSS saturate)
                const satAmount = 100 + (amount / 2);
                args.push('-modulate', `100,${satAmount},100`);
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
            if (this._filters.hueRotate !== 0) {
                filters.push(`hue-rotate(${this._filters.hueRotate}deg)`);
            }
            if (this._filters.sepia > 0) {
                filters.push(`sepia(${this._filters.sepia / 100})`);
            }
            if (this._filters.invert > 0) {
                filters.push(`invert(${this._filters.invert / 100})`);
            }
            
            // Apply tone by using sepia (with amount) + hue-rotate
            if (this._filters.tone !== null && this._filters.toneAmount > 0) {
                // Apply sepia at the chosen amount (0-100% maps to 0-1)
                filters.push(`sepia(${this._filters.toneAmount / 100})`);
                // Then hue-rotate to shift from brown to the target color
                // Sepia's natural hue is ~38 degrees (brown), so we adjust
                const adjustedHue = this._filters.tone - 38;
                filters.push(`hue-rotate(${adjustedHue}deg)`);
                // Boost saturation slightly when tone is active
                filters.push(`saturate(${1 + (this._filters.toneAmount / 200)})`);
            }

            const filterString = filters.length > 0 ? filters.join(' ') : 'none';
            const css = `* { filter: ${filterString}; }`;

            applyCssToWidget(widget, css);
        }
    }
);
