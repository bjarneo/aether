import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {applyCssToWidget} from '../utils/ui-helpers.js';

/**
 * WallpaperEditor - Apply filters and effects to wallpapers before color extraction
 *
 * Uses CSS filters for real-time preview (like web), then applies via GdkPixbuf for export
 */
export const WallpaperEditor = GObject.registerClass(
    {
        Signals: {
            'extract-colors': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperEditor extends Gtk.Box {
        _init(wallpaperPath) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._wallpaperPath = wallpaperPath;
            this._originalPixbuf = null;

            // Filter values
            this._filters = {
                blur: 0,
                saturation: 100, // 0 (grayscale) to 100 (normal)
                contrast: 100, // 0 to 200
                brightness: 100, // 0 to 200
            };

            this._initializeUI();
            this._loadWallpaper();
        }

        _initializeUI() {
            // Header
            const headerBar = new Adw.HeaderBar({
                show_title: false,
            });

            const titleBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
            });

            const titleLabel = new Gtk.Label({
                label: 'Wallpaper Editor',
                css_classes: ['title-4'],
            });
            titleBox.append(titleLabel);
            headerBar.set_title_widget(titleBox);

            // Reset button
            const resetButton = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                tooltip_text: 'Reset all filters',
            });
            resetButton.connect('clicked', () => this._resetFilters());
            headerBar.pack_start(resetButton);

            // Extract colors button
            const extractButton = new Gtk.Button({
                label: 'Extract Colors',
                css_classes: ['suggested-action'],
            });
            extractButton.connect('clicked', () => this._extractColors());
            headerBar.pack_end(extractButton);

            this.append(headerBar);

            // Main content - side by side layout
            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
                hexpand: true,
                vexpand: true,
            });

            // Preview area (left side)
            mainBox.append(this._createPreviewArea());

            // Controls (right side)
            mainBox.append(this._createControlsArea());

            this.append(mainBox);
        }

        _createPreviewArea() {
            const previewBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                hexpand: true,
                vexpand: true,
            });

            const previewLabel = new Gtk.Label({
                label: 'Preview',
                css_classes: ['title-4'],
                xalign: 0,
            });
            previewBox.append(previewLabel);

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                hexpand: true,
                vexpand: true,
            });

            this._previewPicture = new Gtk.Picture({
                can_shrink: false,
                content_fit: Gtk.ContentFit.CONTAIN,
            });

            scrolled.set_child(this._previewPicture);
            
            const frame = new Gtk.Frame({
                css_classes: ['card'],
                child: scrolled,
            });
            previewBox.append(frame);

            return previewBox;
        }

        _createControlsArea() {
            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                width_request: 320,
            });

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

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
                    'Adjust brightness'
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
                    '0% = grayscale, 100% = normal'
                )
            );

            scrolled.set_child(group);
            controlsBox.append(scrolled);

            return controlsBox;
        }

        _createSliderRow(title, key, min, max, step, defaultValue, subtitle) {
            const row = new Adw.ActionRow({
                title: title,
                subtitle: subtitle,
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 6,
                margin_bottom: 6,
            });

            const controlBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
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
                label: this._formatValue(key, defaultValue),
                width_chars: 6,
                xalign: 1,
                css_classes: ['dim-label'],
            });

            scale.connect('value-changed', () => {
                const value = scale.get_value();
                this._filters[key] = value;
                valueLabel.set_label(this._formatValue(key, value));
                this._updatePreviewCss();
            });

            controlBox.append(scale);
            controlBox.append(valueLabel);
            box.append(controlBox);
            
            row.add_suffix(box);

            // Store references for reset
            if (!this._sliders) this._sliders = {};
            this._sliders[key] = {scale, valueLabel, defaultValue};

            return row;
        }

        _formatValue(key, value) {
            const rounded = Math.round(value);
            if (key === 'blur') {
                return `${rounded}px`;
            }
            return `${rounded}%`;
        }

        _updatePreviewCss() {
            // Build CSS filter string
            const filters = [];
            
            if (this._filters.blur > 0) {
                filters.push(`blur(${this._filters.blur}px)`);
            }
            if (this._filters.brightness !== 100) {
                filters.push(`brightness(${this._filters.brightness}%)`);
            }
            if (this._filters.contrast !== 100) {
                filters.push(`contrast(${this._filters.contrast}%)`);
            }
            if (this._filters.saturation !== 100) {
                filters.push(`saturate(${this._filters.saturation}%)`);
            }

            const filterString = filters.length > 0 ? filters.join(' ') : 'none';
            
            const css = `
                * {
                    -webkit-filter: ${filterString};
                    filter: ${filterString};
                }
            `;
            
            applyCssToWidget(this._previewPicture, css);
        }

        _loadWallpaper() {
            try {
                this._originalPixbuf = GdkPixbuf.Pixbuf.new_from_file(
                    this._wallpaperPath
                );

                // Downsample if too large for preview
                const maxDim = 1920;
                const maxSize = Math.max(
                    this._originalPixbuf.get_width(),
                    this._originalPixbuf.get_height()
                );

                if (maxSize > maxDim) {
                    const scale = maxDim / maxSize;
                    const newWidth = Math.round(
                        this._originalPixbuf.get_width() * scale
                    );
                    const newHeight = Math.round(
                        this._originalPixbuf.get_height() * scale
                    );
                    this._originalPixbuf = this._originalPixbuf.scale_simple(
                        newWidth,
                        newHeight,
                        GdkPixbuf.InterpType.BILINEAR
                    );
                }

                // Initialize filtered pixbuf
                this._filteredPixbuf = this._originalPixbuf;

                // Set drawing area size to match image
                this._drawingArea.set_content_width(
                    this._originalPixbuf.get_width()
                );
                this._drawingArea.set_content_height(
                    this._originalPixbuf.get_height()
                );

                this._drawingArea.queue_draw();
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        _drawPreview(cr, width, height) {
            if (!this._originalPixbuf) return;

            // Draw the filtered pixbuf (or original if no filters applied)
            const pixbuf = this._filteredPixbuf || this._originalPixbuf;
            Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
            cr.paint();
            
            // Only add blur hint overlay in Cairo (blur too expensive for real-time)
            if (this._filters.blur > 0) {
                const imgWidth = pixbuf.get_width();
                const imgHeight = pixbuf.get_height();
                const blurAmount = this._filters.blur / 20;
                cr.setSourceRGBA(0.95, 0.95, 0.95, blurAmount * 0.15);
                cr.rectangle(0, 0, imgWidth, imgHeight);
                cr.fill();
            }
        }

        _applyBrightness(pixbuf, brightness) {
            if (brightness === 0) return pixbuf;

            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();

            const factor = brightness / 100;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * rowstride + x * n_channels;

                    for (let c = 0; c < 3; c++) {
                        let value = pixels[offset + c];
                        value = Math.max(
                            0,
                            Math.min(255, value + factor * 255)
                        );
                        pixels[offset + c] = value;
                    }
                }
            }

            return result;
        }

        _applyContrast(pixbuf, contrast) {
            if (contrast === 0) return pixbuf;

            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();

            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * rowstride + x * n_channels;

                    for (let c = 0; c < 3; c++) {
                        let value = pixels[offset + c];
                        value = factor * (value - 128) + 128;
                        value = Math.max(0, Math.min(255, value));
                        pixels[offset + c] = value;
                    }
                }
            }

            return result;
        }

        _applySaturation(pixbuf, saturation) {
            if (saturation === 0) return pixbuf;

            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();

            // Convert to 0-1 range where 0 is grayscale, 1 is normal
            const sat = 1 + saturation / 100;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * rowstride + x * n_channels;

                    const r = pixels[offset];
                    const g = pixels[offset + 1];
                    const b = pixels[offset + 2];

                    // Calculate grayscale value
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                    // Interpolate between grayscale and original
                    pixels[offset] = Math.max(
                        0,
                        Math.min(255, gray + sat * (r - gray))
                    );
                    pixels[offset + 1] = Math.max(
                        0,
                        Math.min(255, gray + sat * (g - gray))
                    );
                    pixels[offset + 2] = Math.max(
                        0,
                        Math.min(255, gray + sat * (b - gray))
                    );
                }
            }

            return result;
        }

        _applyTemperaturePixbuf(pixbuf, temperature) {
            if (temperature === 0) return pixbuf;

            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();

            const temp = temperature / 100;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * rowstride + x * n_channels;

                    if (temp > 0) {
                        // Warm: increase red, decrease blue
                        pixels[offset] = Math.min(
                            255,
                            pixels[offset] + temp * 30
                        );
                        pixels[offset + 2] = Math.max(
                            0,
                            pixels[offset + 2] - temp * 30
                        );
                    } else {
                        // Cool: decrease red, increase blue
                        pixels[offset] = Math.max(
                            0,
                            pixels[offset] + temp * 30
                        );
                        pixels[offset + 2] = Math.min(
                            255,
                            pixels[offset + 2] - temp * 30
                        );
                    }
                }
            }

            return result;
        }

        _applyVignettePixbuf(pixbuf, vignette) {
            if (vignette === 0) return pixbuf;

            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();

            const centerX = width / 2;
            const centerY = height / 2;
            const maxDistance = Math.sqrt(
                centerX * centerX + centerY * centerY
            );
            const vignetteStrength = vignette / 100;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * rowstride + x * n_channels;

                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const factor = Math.max(
                        0,
                        1 - (distance / maxDistance) * vignetteStrength * 1.5
                    );

                    for (let c = 0; c < 3; c++) {
                        pixels[offset + c] = Math.max(
                            0,
                            Math.min(255, pixels[offset + c] * factor)
                        );
                    }
                }
            }

            return result;
        }

        _applyBlur(pixbuf, blurAmount) {
            if (blurAmount === 0) return pixbuf;

            // Simple box blur approximation
            const radius = Math.round(blurAmount / 2);
            if (radius < 1) return pixbuf;

            let result = pixbuf.copy();

            // Apply horizontal blur
            result = this._applyBoxBlur(result, radius, true);
            // Apply vertical blur
            result = this._applyBoxBlur(result, radius, false);

            return result;
        }

        _applyBoxBlur(pixbuf, radius, horizontal) {
            const result = pixbuf.copy();
            const pixels = result.get_pixels();
            const n_channels = result.get_n_channels();
            const rowstride = result.get_rowstride();
            const width = result.get_width();
            const height = result.get_height();
            const original = pixbuf.get_pixels();

            const size = radius * 2 + 1;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let r = 0,
                        g = 0,
                        b = 0;
                    let count = 0;

                    for (let i = -radius; i <= radius; i++) {
                        let sx = horizontal ? x + i : x;
                        let sy = horizontal ? y : y + i;

                        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                            const offset = sy * rowstride + sx * n_channels;
                            r += original[offset];
                            g += original[offset + 1];
                            b += original[offset + 2];
                            count++;
                        }
                    }

                    const offset = y * rowstride + x * n_channels;
                    pixels[offset] = r / count;
                    pixels[offset + 1] = g / count;
                    pixels[offset + 2] = b / count;
                }
            }

            return result;
        }

        _resetFilters() {
            Object.keys(this._filters).forEach(key => {
                this._filters[key] = 0;
            });

            Object.keys(this._sliders).forEach(key => {
                const {scale, valueLabel, defaultValue} = this._sliders[key];
                scale.set_value(defaultValue);
                valueLabel.set_label(this._formatValue(key, defaultValue));
            });

            this._filteredPixbuf = this._originalPixbuf;
            this._drawingArea.queue_draw();
        }

        async _extractColors() {
            if (!this._originalPixbuf) return;

            try {
                // Create a new pixbuf with filters applied for export
                let pixbuf = this._originalPixbuf.copy();

                // Apply all filters to the pixbuf for export
                pixbuf = this._applyBrightness(pixbuf, this._filters.brightness);
                pixbuf = this._applyContrast(pixbuf, this._filters.contrast);
                pixbuf = this._applySaturation(pixbuf, this._filters.saturation);
                pixbuf = this._applyTemperaturePixbuf(
                    pixbuf,
                    this._filters.temperature
                );
                pixbuf = this._applyVignettePixbuf(pixbuf, this._filters.vignette);

                // Blur is expensive, apply last if needed
                if (this._filters.blur > 0) {
                    pixbuf = this._applyBlur(pixbuf, this._filters.blur);
                }

                // Save processed wallpaper to temp file
                const cacheDir = GLib.build_filenamev([
                    GLib.get_user_cache_dir(),
                    'aether',
                ]);
                GLib.mkdir_with_parents(cacheDir, 0o755);

                const tempPath = GLib.build_filenamev([
                    cacheDir,
                    'processed-wallpaper.png',
                ]);

                pixbuf.savev(tempPath, 'png', [], []);

                // Emit signal to extract colors from processed image
                this.emit('extract-colors', tempPath);
            } catch (e) {
                console.error('Failed to save processed wallpaper:', e.message);
            }
        }

        hasActiveFilters() {
            return Object.values(this._filters).some(value => value !== 0);
        }

        getProcessedPath() {
            const cacheDir = GLib.build_filenamev([
                GLib.get_user_cache_dir(),
                'aether',
            ]);
            return GLib.build_filenamev([cacheDir, 'processed-wallpaper.png']);
        }
    }
);
