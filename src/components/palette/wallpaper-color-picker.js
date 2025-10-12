import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {rgbToHex, hexToRgb} from '../../utils/color-utils.js';

// Constants
const ZOOM_CONFIG = {
    MIN: 0.25,
    MAX: 4.0,
    STEP: 0.25,
    DEFAULT: 1.0,
};

const CROSSHAIR_CONFIG = {
    COLOR: {r: 1, g: 1, b: 1, a: 0.8},
    LINE_WIDTH: 1,
    CIRCLE_RADIUS: 10,
};

const UI_CONFIG = {
    PREVIEW_HEIGHT: 350,
    COLOR_SWATCH_WIDTH: 60,
    COLOR_SWATCH_HEIGHT: 40,
};

/**
 * WallpaperColorPicker - Interactive color picker with zoom and real-time preview
 *
 * Features:
 * - Click on wallpaper to extract colors
 * - Zoom in/out with controls (25% - 400%)
 * - Real-time color preview with hex and RGB values
 * - Crosshair cursor guide
 *
 * Signals:
 * - 'color-picked': Emitted when user clicks to select a color (params: hex color string)
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

            // State
            this._wallpaperPath = wallpaperPath;
            this._pixbuf = null;
            this._scaledPixbuf = null; // Cache scaled pixbuf for performance
            this._zoomLevel = ZOOM_CONFIG.DEFAULT;
            this._currentColor = '#000000';
            this._mouseX = 0;
            this._mouseY = 0;

            this._initializeUI();
            this._loadWallpaper();
        }

        // UI Initialization
        _initializeUI() {
            this.append(this._createHeader());
            this.append(this._createContent());
        }

        _createHeader() {
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
            headerBox.append(this._createZoomControls());

            return headerBox;
        }

        _createZoomControls() {
            this._zoomLabel = new Gtk.Label({
                label: this._formatZoomLabel(this._zoomLevel),
                css_classes: ['dim-label'],
                width_request: 50,
            });

            const zoomBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                css_classes: ['linked'],
            });

            const zoomOutBtn = this._createButton('zoom-out-symbolic', 'Zoom out', () =>
                this._adjustZoom(-ZOOM_CONFIG.STEP)
            );
            const zoomResetBtn = this._createButton(null, 'Reset zoom to fit', () =>
                this._resetZoom(), 'Fit'
            );
            const zoomInBtn = this._createButton('zoom-in-symbolic', 'Zoom in', () =>
                this._adjustZoom(ZOOM_CONFIG.STEP)
            );

            zoomBox.append(zoomOutBtn);
            zoomBox.append(this._zoomLabel);
            zoomBox.append(zoomResetBtn);
            zoomBox.append(zoomInBtn);

            return zoomBox;
        }

        _createButton(iconName, tooltip, callback, label = null) {
            const btn = new Gtk.Button({
                tooltip_text: tooltip,
            });

            if (iconName) {
                btn.set_icon_name(iconName);
            } else if (label) {
                btn.set_label(label);
            }

            btn.connect('clicked', callback);
            return btn;
        }

        _createContent() {
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                hexpand: true,
            });

            contentBox.append(this._createWallpaperView());
            contentBox.append(this._createColorPreview());

            return contentBox;
        }

        _createWallpaperView() {
            const scrolled = new Gtk.ScrolledWindow({
                hexpand: true,
                vexpand: true,
                height_request: UI_CONFIG.PREVIEW_HEIGHT,
                css_classes: ['card'],
            });

            this._drawingArea = new Gtk.DrawingArea({
                hexpand: true,
                vexpand: true,
            });

            this._drawingArea.set_draw_func((area, cr, width, height) => {
                this._drawWallpaper(cr);
            });

            this._setupEventControllers();

            scrolled.set_child(this._drawingArea);
            return scrolled;
        }

        _setupEventControllers() {
            // Mouse motion for live preview
            const motionController = new Gtk.EventControllerMotion();
            motionController.connect('motion', (_, x, y) => this._handleMouseMove(x, y));
            this._drawingArea.add_controller(motionController);

            // Click to pick color
            const clickGesture = new Gtk.GestureClick();
            clickGesture.connect('pressed', (_, nPress, x, y) => this._handleClick(x, y));
            this._drawingArea.add_controller(clickGesture);
        }

        _createColorPreview() {
            const previewBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
            });

            const colorLabel = new Gtk.Label({
                label: 'Color Preview:',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
            });
            previewBox.append(colorLabel);

            this._colorPreview = new Gtk.Box({
                width_request: UI_CONFIG.COLOR_SWATCH_WIDTH,
                height_request: UI_CONFIG.COLOR_SWATCH_HEIGHT,
                css_classes: ['card'],
            });
            previewBox.append(this._colorPreview);

            this._colorValueLabel = new Gtk.Label({
                label: '#000000',
                css_classes: ['title-4'],
                selectable: true,
                xalign: 0,
            });
            previewBox.append(this._colorValueLabel);

            this._rgbLabel = new Gtk.Label({
                label: 'RGB: 0, 0, 0',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
                hexpand: true,
            });
            previewBox.append(this._rgbLabel);

            this._updateColorPreview('#000000');

            return previewBox;
        }

        // Zoom Management
        _adjustZoom(delta) {
            const newZoom = this._zoomLevel + delta;
            this._setZoom(Math.max(ZOOM_CONFIG.MIN, Math.min(ZOOM_CONFIG.MAX, newZoom)));
        }

        _resetZoom() {
            this._setZoom(ZOOM_CONFIG.DEFAULT);
        }

        _setZoom(zoom) {
            this._zoomLevel = zoom;
            this._zoomLabel.set_label(this._formatZoomLabel(zoom));
            this._scaledPixbuf = null; // Invalidate cache
            this._updateDrawingAreaSize();
            this._drawingArea.queue_draw();
        }

        _formatZoomLabel(zoom) {
            return `${Math.round(zoom * 100)}%`;
        }

        _updateDrawingAreaSize() {
            if (!this._pixbuf) return;

            const width = Math.round(this._pixbuf.get_width() * this._zoomLevel);
            const height = Math.round(this._pixbuf.get_height() * this._zoomLevel);

            this._drawingArea.set_content_width(width);
            this._drawingArea.set_content_height(height);
        }

        // Wallpaper Loading & Drawing
        _loadWallpaper() {
            try {
                this._pixbuf = GdkPixbuf.Pixbuf.new_from_file(this._wallpaperPath);
                this._updateDrawingAreaSize();
                this._drawingArea.queue_draw();
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        _drawWallpaper(cr) {
            if (!this._pixbuf) return;

            // Draw wallpaper (cached if zoom unchanged)
            const pixbuf = this._getScaledPixbuf();
            Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
            cr.paint();

            // Draw crosshair cursor guide
            if (this._mouseX >= 0 && this._mouseY >= 0) {
                this._drawCrosshair(cr, this._mouseX, this._mouseY);
            }
        }

        _getScaledPixbuf() {
            // Cache scaled pixbuf for performance (only recreate on zoom change)
            if (this._zoomLevel === 1.0) {
                return this._pixbuf;
            }

            if (!this._scaledPixbuf) {
                const width = Math.round(this._pixbuf.get_width() * this._zoomLevel);
                const height = Math.round(this._pixbuf.get_height() * this._zoomLevel);
                this._scaledPixbuf = this._pixbuf.scale_simple(
                    width,
                    height,
                    GdkPixbuf.InterpType.BILINEAR
                );
            }

            return this._scaledPixbuf;
        }

        _drawCrosshair(cr, x, y) {
            const {r, g, b, a} = CROSSHAIR_CONFIG.COLOR;
            const scaledWidth = Math.round(this._pixbuf.get_width() * this._zoomLevel);
            const scaledHeight = Math.round(this._pixbuf.get_height() * this._zoomLevel);

            cr.setSourceRGBA(r, g, b, a);
            cr.setLineWidth(CROSSHAIR_CONFIG.LINE_WIDTH);

            // Vertical line
            cr.moveTo(x, 0);
            cr.lineTo(x, scaledHeight);
            cr.stroke();

            // Horizontal line
            cr.moveTo(0, y);
            cr.lineTo(scaledWidth, y);
            cr.stroke();

            // Circle
            cr.arc(x, y, CROSSHAIR_CONFIG.CIRCLE_RADIUS, 0, 2 * Math.PI);
            cr.stroke();
        }

        // Event Handlers
        _handleMouseMove(x, y) {
            this._mouseX = x;
            this._mouseY = y;

            const color = this._getColorAt(x, y);
            if (color) {
                this._currentColor = color;
                this._updateColorPreview(color);
            }

            this._drawingArea.queue_draw();
        }

        _handleClick(x, y) {
            const color = this._getColorAt(x, y);
            if (color) {
                this.emit('color-picked', color);
            }
        }

        // Color Extraction
        _getColorAt(x, y) {
            if (!this._pixbuf) return null;

            // Convert screen coordinates to image coordinates
            const imgX = Math.floor(x / this._zoomLevel);
            const imgY = Math.floor(y / this._zoomLevel);

            // Bounds check
            if (!this._isWithinBounds(imgX, imgY)) {
                return null;
            }

            try {
                return this._extractPixelColor(imgX, imgY);
            } catch (e) {
                console.error('Failed to extract color:', e.message);
                return null;
            }
        }

        _isWithinBounds(x, y) {
            return (
                x >= 0 &&
                y >= 0 &&
                x < this._pixbuf.get_width() &&
                y < this._pixbuf.get_height()
            );
        }

        _extractPixelColor(x, y) {
            const pixels = this._pixbuf.get_pixels();
            const rowstride = this._pixbuf.get_rowstride();
            const nChannels = this._pixbuf.get_n_channels();
            const offset = y * rowstride + x * nChannels;

            const r = pixels[offset];
            const g = pixels[offset + 1];
            const b = pixels[offset + 2];

            return rgbToHex(r, g, b);
        }

        // UI Updates
        _updateColorPreview(color) {
            // Update swatch color
            const css = `
                * {
                    background-color: ${color};
                    border: 2px solid alpha(@borders, 0.5);
                }
            `;
            applyCssToWidget(this._colorPreview, css);

            // Update labels
            this._colorValueLabel.set_label(color.toUpperCase());

            const rgb = hexToRgb(color);
            if (rgb) {
                this._rgbLabel.set_label(`RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }
        }

        // Public API
        getCurrentColor() {
            return this._currentColor;
        }
    }
);
