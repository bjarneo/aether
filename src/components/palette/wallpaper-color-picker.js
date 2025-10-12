import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Adw from 'gi://Adw?version=1';

import {applyCssToWidget} from '../../utils/ui-helpers.js';

/**
 * WallpaperColorPicker - Interactive color picker with zoom and real-time preview
 * Allows users to click on any part of a wallpaper to extract colors
 */
export const WallpaperColorPicker = GObject.registerClass(
    {
        Signals: {
            'color-picked': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperColorPicker extends Gtk.Box {
        _init(wallpaperPath) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                hexpand: true,
            });

            this._wallpaperPath = wallpaperPath;
            this._pixbuf = null;
            this._zoomLevel = 1.0; // 1.0 = 100% zoom for the wallpaper
            this._currentColor = '#000000';

            this._initializeUI();
            this._loadWallpaper();
        }

        _initializeUI() {
            // Header with title and zoom controls
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_bottom: 12,
            });

            const titleLabel = new Gtk.Label({
                label: 'Pick Color from Wallpaper',
                css_classes: ['title-4'],
                xalign: 0,
                hexpand: true,
            });
            headerBox.append(titleLabel);

            // Zoom level label
            this._zoomLabel = new Gtk.Label({
                label: `${Math.round(this._zoomLevel * 100)}%`,
                css_classes: ['dim-label'],
                width_request: 50,
            });

            // Zoom controls
            const zoomBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                css_classes: ['linked'],
            });

            const zoomOutBtn = new Gtk.Button({
                icon_name: 'zoom-out-symbolic',
                tooltip_text: 'Zoom out',
            });
            zoomOutBtn.connect('clicked', () => this._adjustZoom(-0.25));

            const zoomResetBtn = new Gtk.Button({
                label: 'Fit',
                tooltip_text: 'Reset zoom to fit',
            });
            zoomResetBtn.connect('clicked', () => this._resetZoom());

            const zoomInBtn = new Gtk.Button({
                icon_name: 'zoom-in-symbolic',
                tooltip_text: 'Zoom in',
            });
            zoomInBtn.connect('clicked', () => this._adjustZoom(0.25));

            zoomBox.append(zoomOutBtn);
            zoomBox.append(this._zoomLabel);
            zoomBox.append(zoomResetBtn);
            zoomBox.append(zoomInBtn);

            headerBox.append(zoomBox);
            this.append(headerBox);

            // Main content area
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                hexpand: true,
            });

            // Wallpaper preview in scrolled window
            const scrolled = new Gtk.ScrolledWindow({
                hexpand: true,
                vexpand: true,
                height_request: 350,
                css_classes: ['card'],
            });

            // Drawing area for the wallpaper
            this._drawingArea = new Gtk.DrawingArea({
                hexpand: true,
                vexpand: true,
            });
            this._drawingArea.set_draw_func((area, cr, width, height) => {
                this._drawWallpaper(cr, width, height);
            });

            // Motion controller for live preview
            const motionController = new Gtk.EventControllerMotion();
            motionController.connect('motion', (controller, x, y) => {
                this._onMouseMove(x, y);
            });
            this._drawingArea.add_controller(motionController);

            // Click controller to pick color
            const clickGesture = new Gtk.GestureClick();
            clickGesture.connect('pressed', (gesture, nPress, x, y) => {
                this._onMouseClick(x, y);
            });
            this._drawingArea.add_controller(clickGesture);

            scrolled.set_child(this._drawingArea);
            contentBox.append(scrolled);

            // Bottom preview panel
            const previewBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
            });

            // Color preview swatch
            const colorLabel = new Gtk.Label({
                label: 'Color Preview:',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
            });
            previewBox.append(colorLabel);

            this._colorPreview = new Gtk.Box({
                width_request: 60,
                height_request: 40,
                css_classes: ['card'],
            });
            previewBox.append(this._colorPreview);

            // Color hex value
            this._colorValueLabel = new Gtk.Label({
                label: '#000000',
                css_classes: ['title-4'],
                selectable: true,
                xalign: 0,
            });
            previewBox.append(this._colorValueLabel);

            // RGB values
            this._rgbLabel = new Gtk.Label({
                label: 'RGB: 0, 0, 0',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
                hexpand: true,
            });
            previewBox.append(this._rgbLabel);

            // Now that all widgets are created, set initial color
            this._updateColorPreview('#000000');

            contentBox.append(previewBox);
            this.append(contentBox);

            // Store mouse position
            this._mouseX = 0;
            this._mouseY = 0;
        }

        _adjustZoom(delta) {
            this._zoomLevel = Math.max(0.25, Math.min(4.0, this._zoomLevel + delta));
            this._zoomLabel.set_label(`${Math.round(this._zoomLevel * 100)}%`);
            this._updateDrawingAreaSize();
            this._drawingArea.queue_draw();
        }

        _resetZoom() {
            this._zoomLevel = 1.0;
            this._zoomLabel.set_label('100%');
            this._updateDrawingAreaSize();
            this._drawingArea.queue_draw();
        }

        _updateDrawingAreaSize() {
            if (!this._pixbuf) return;
            const width = Math.round(this._pixbuf.get_width() * this._zoomLevel);
            const height = Math.round(this._pixbuf.get_height() * this._zoomLevel);
            this._drawingArea.set_content_width(width);
            this._drawingArea.set_content_height(height);
        }

        _loadWallpaper() {
            try {
                // Load the wallpaper into a pixbuf
                this._pixbuf = GdkPixbuf.Pixbuf.new_from_file(
                    this._wallpaperPath
                );
                this._updateDrawingAreaSize();
                this._drawingArea.queue_draw();
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        _drawWallpaper(cr, width, height) {
            if (!this._pixbuf) return;

            // Scale and draw the pixbuf
            const imgWidth = this._pixbuf.get_width();
            const imgHeight = this._pixbuf.get_height();
            const scaledWidth = Math.round(imgWidth * this._zoomLevel);
            const scaledHeight = Math.round(imgHeight * this._zoomLevel);

            // Scale the pixbuf if needed
            if (this._zoomLevel !== 1.0) {
                const scaled = this._pixbuf.scale_simple(
                    scaledWidth,
                    scaledHeight,
                    GdkPixbuf.InterpType.BILINEAR
                );
                Gdk.cairo_set_source_pixbuf(cr, scaled, 0, 0);
            } else {
                Gdk.cairo_set_source_pixbuf(cr, this._pixbuf, 0, 0);
            }
            cr.paint();

            // Draw crosshair at mouse position if hovering
            if (this._mouseX >= 0 && this._mouseY >= 0) {
                cr.setSourceRGBA(1, 1, 1, 0.8);
                cr.setLineWidth(1);

                // Vertical line
                cr.moveTo(this._mouseX, 0);
                cr.lineTo(this._mouseX, scaledHeight);
                cr.stroke();

                // Horizontal line
                cr.moveTo(0, this._mouseY);
                cr.lineTo(scaledWidth, this._mouseY);
                cr.stroke();

                // Circle around cursor
                cr.arc(this._mouseX, this._mouseY, 10, 0, 2 * Math.PI);
                cr.stroke();
            }
        }

        _onMouseMove(x, y) {
            this._mouseX = x;
            this._mouseY = y;

            // Get color at this position
            const color = this._getColorAt(x, y);
            if (color) {
                this._currentColor = color;
                this._updateColorPreview(color);
            }

            // Redraw wallpaper
            this._drawingArea.queue_draw();
        }

        _onMouseClick(x, y) {
            console.log(`Click at (${x}, ${y})`);
            const color = this._getColorAt(x, y);
            console.log(`Got color: ${color}`);
            if (color) {
                console.log(`Emitting color-picked signal with color: ${color}`);
                this.emit('color-picked', color);
            } else {
                console.log('No color obtained from click position');
            }
        }

        _getColorAt(x, y) {
            if (!this._pixbuf) return null;

            // Convert screen coordinates to image coordinates based on zoom
            const imgX = Math.floor(x / this._zoomLevel);
            const imgY = Math.floor(y / this._zoomLevel);

            const imgWidth = this._pixbuf.get_width();
            const imgHeight = this._pixbuf.get_height();

            // Bounds check
            if (
                imgX < 0 ||
                imgY < 0 ||
                imgX >= imgWidth ||
                imgY >= imgHeight
            ) {
                return null;
            }

            try {
                const pixels = this._pixbuf.get_pixels();
                const rowstride = this._pixbuf.get_rowstride();
                const nChannels = this._pixbuf.get_n_channels();

                const offset = imgY * rowstride + imgX * nChannels;

                const r = pixels[offset];
                const g = pixels[offset + 1];
                const b = pixels[offset + 2];

                return this._rgbToHex(r, g, b);
            } catch (e) {
                console.error('Failed to get color:', e.message);
                return null;
            }
        }

        _rgbToHex(r, g, b) {
            const toHex = num => {
                const hex = num.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }

        _hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? {
                      r: parseInt(result[1], 16),
                      g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16),
                  }
                : null;
        }

        _updateColorPreview(color) {
            const css = `
                * {
                    background-color: ${color};
                    border: 2px solid alpha(@borders, 0.5);
                }
            `;
            applyCssToWidget(this._colorPreview, css);

            this._colorValueLabel.set_label(color.toUpperCase());

            const rgb = this._hexToRgb(color);
            if (rgb) {
                this._rgbLabel.set_label(`RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }
        }

        getCurrentColor() {
            return this._currentColor;
        }
    }
);
