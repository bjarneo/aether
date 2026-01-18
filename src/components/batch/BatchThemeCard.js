/**
 * BatchThemeCard - Individual result card for batch processing comparison
 *
 * Displays:
 * - Wallpaper thumbnail
 * - 16-color swatch grid (2 rows x 8 colors)
 * - Selection indicator
 * - Preview button overlay
 *
 * Signals:
 * - 'selected' - When card is clicked/selected
 * - 'preview-requested' - When preview button is clicked
 *
 * @module BatchThemeCard
 */

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {SPACING} from '../../constants/ui-constants.js';

/**
 * BatchThemeCard - Result card component for batch comparison
 * @class
 * @extends {Gtk.Box}
 */
export const BatchThemeCard = GObject.registerClass(
    {
        Signals: {
            selected: {},
            'preview-requested': {},
        },
        Properties: {
            selected: GObject.ParamSpec.boolean(
                'selected',
                'Selected',
                'Whether this card is selected',
                GObject.ParamFlags.READWRITE,
                false
            ),
        },
    },
    class BatchThemeCard extends Gtk.Box {
        /**
         * Create a new BatchThemeCard
         * @param {Object} result - Processing result object
         * @param {Object} result.wallpaper - Wallpaper data with path
         * @param {string[]} result.colors - 16-color palette array
         * @param {boolean} result.success - Whether extraction succeeded
         * @param {string} [result.error] - Error message if failed
         */
        _init(result) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
                css_classes: ['card'],
            });

            this._result = result;
            this._selected = false;

            this._initializeUI();
        }

        _initializeUI() {
            this._applySelectionStyle(false);

            // Image container with overlay
            const overlay = new Gtk.Overlay();

            // Wallpaper thumbnail
            this._picture = new Gtk.Picture({
                height_request: 120,
                can_shrink: true,
                hexpand: true,
                content_fit: Gtk.ContentFit.COVER,
            });
            applyCssToWidget(
                this._picture,
                `
                picture {
                    border-radius: 0;
                }
            `
            );

            // Load wallpaper image
            if (this._result.wallpaper?.path) {
                const file = Gio.File.new_for_path(this._result.wallpaper.path);
                if (file.query_exists(null)) {
                    this._picture.set_file(file);
                }
            }

            overlay.set_child(this._picture);

            // Preview button overlay (top-right)
            const previewButton = new Gtk.Button({
                icon_name: 'view-reveal-symbolic',
                tooltip_text: 'Preview this theme',
                halign: Gtk.Align.END,
                valign: Gtk.Align.START,
                margin_top: 6,
                margin_end: 6,
            });
            applyCssToWidget(
                previewButton,
                `
                button {
                    background-color: alpha(@window_bg_color, 0.9);
                    border-radius: 0;
                    min-width: 28px;
                    min-height: 28px;
                    padding: 4px;
                }
                button:hover {
                    background-color: @window_bg_color;
                }
            `
            );
            previewButton.connect('clicked', () => {
                this.emit('preview-requested');
            });
            overlay.add_overlay(previewButton);

            // Selection checkmark overlay (top-left)
            this._selectionIndicator = new Gtk.Image({
                icon_name: 'emblem-ok-symbolic',
                halign: Gtk.Align.START,
                valign: Gtk.Align.START,
                margin_top: 6,
                margin_start: 6,
                visible: false,
            });
            applyCssToWidget(
                this._selectionIndicator,
                `
                image {
                    background-color: @accent_bg_color;
                    color: @accent_fg_color;
                    border-radius: 0;
                    padding: 4px;
                    min-width: 20px;
                    min-height: 20px;
                }
            `
            );
            overlay.add_overlay(this._selectionIndicator);

            // Error overlay for failed extractions
            if (!this._result.success) {
                const errorOverlay = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                    // Show full error message on hover
                    tooltip_text:
                        this._result.error || 'Color extraction failed',
                });
                applyCssToWidget(
                    errorOverlay,
                    `
                    box {
                        background-color: alpha(@error_bg_color, 0.9);
                        color: @error_fg_color;
                        padding: 12px 16px;
                        border-radius: 0;
                    }
                `
                );

                const errorIcon = new Gtk.Image({
                    icon_name: 'dialog-error-symbolic',
                });
                applyCssToWidget(
                    errorIcon,
                    `
                    image {
                        -gtk-icon-size: 24px;
                    }
                `
                );
                errorOverlay.append(errorIcon);

                const errorLabel = new Gtk.Label({
                    label: 'Failed',
                    css_classes: ['caption', 'heading'],
                });
                errorOverlay.append(errorLabel);

                overlay.add_overlay(errorOverlay);

                // Dim the whole card for failed extractions
                applyCssToWidget(
                    this._picture,
                    `
                    picture {
                        border-radius: 0;
                        opacity: 0.5;
                        filter: grayscale(50%);
                    }
                `
                );
            }

            this.append(overlay);

            // Color swatches grid (2 rows x 8 colors) or placeholder for failed
            if (this._result.success && this._result.colors?.length === 16) {
                const swatchesGrid = this._createSwatchesGrid();
                this.append(swatchesGrid);
            } else if (!this._result.success) {
                // Placeholder for failed extractions
                const placeholder = new Gtk.Box({
                    height_request: 44, // Same height as swatches grid
                    hexpand: true,
                });
                applyCssToWidget(
                    placeholder,
                    `
                    box {
                        background: repeating-linear-gradient(
                            45deg,
                            alpha(@error_bg_color, 0.1),
                            alpha(@error_bg_color, 0.1) 10px,
                            transparent 10px,
                            transparent 20px
                        );
                        border: 1px dashed alpha(@error_bg_color, 0.3);
                    }
                `
                );
                this.append(placeholder);
            }

            // Wallpaper name
            const nameLabel = new Gtk.Label({
                label: this._getWallpaperName(),
                xalign: 0,
                ellipsize: 3, // PANGO_ELLIPSIZE_END
                max_width_chars: 20,
            });
            applyCssToWidget(
                nameLabel,
                `
                label {
                    font-size: 11px;
                    opacity: 0.7;
                }
            `
            );
            this.append(nameLabel);

            // Click gesture for selection (only for successful extractions)
            if (this._result.success) {
                const clickGesture = new Gtk.GestureClick();
                clickGesture.connect('pressed', () => {
                    this.emit('selected');
                });
                this.add_controller(clickGesture);
                this.set_cursor(Gdk.Cursor.new_from_name('pointer', null));
            } else {
                // Set not-allowed cursor for failed cards
                this.set_cursor(Gdk.Cursor.new_from_name('not-allowed', null));
            }
        }

        /**
         * Create the 2x8 color swatches grid
         * @private
         * @returns {Gtk.Grid} Swatches grid widget
         */
        _createSwatchesGrid() {
            const grid = new Gtk.Grid({
                row_spacing: 2,
                column_spacing: 2,
                hexpand: true,
            });

            const colors = this._result.colors;
            const swatchSize = 20;

            // Row 1: colors 0-7
            for (let i = 0; i < 8; i++) {
                const swatch = this._createSwatch(colors[i], swatchSize);
                swatch.set_hexpand(true);
                grid.attach(swatch, i, 0, 1, 1);
            }

            // Row 2: colors 8-15
            for (let i = 8; i < 16; i++) {
                const swatch = this._createSwatch(colors[i], swatchSize);
                swatch.set_hexpand(true);
                grid.attach(swatch, i - 8, 1, 1, 1);
            }

            return grid;
        }

        /**
         * Create a single color swatch
         * @private
         * @param {string} color - Hex color
         * @param {number} size - Swatch size
         * @returns {Gtk.Box} Swatch widget
         */
        _createSwatch(color, size) {
            const swatch = new Gtk.Box({
                width_request: size,
                height_request: size,
            });
            applyCssToWidget(
                swatch,
                `
                box {
                    background-color: ${color};
                    border-radius: 0;
                    min-width: ${size}px;
                    min-height: ${size}px;
                }
            `
            );
            return swatch;
        }

        /**
         * Get wallpaper display name
         * @private
         * @returns {string} Wallpaper name
         */
        _getWallpaperName() {
            const {wallpaper} = this._result;
            return (
                wallpaper?.name ||
                wallpaper?.path?.split('/').pop() ||
                'Unknown'
            );
        }

        /**
         * Get the result data
         * @returns {Object} Result object
         */
        getResult() {
            return this._result;
        }

        /**
         * Set selected state
         * @param {boolean} selected - Whether card is selected
         */
        setSelected(selected) {
            if (this._selected === selected) return;

            this._selected = selected;
            this._selectionIndicator.set_visible(selected);
            this._applySelectionStyle(selected);
            this.notify('selected');
        }

        /**
         * Apply CSS styling based on selection state
         * @private
         * @param {boolean} selected - Whether selected
         */
        _applySelectionStyle(selected) {
            const borderColor = selected ? '@accent_bg_color' : 'transparent';
            const hoverColor = selected
                ? '@accent_bg_color'
                : 'alpha(@accent_bg_color, 0.5)';

            applyCssToWidget(
                this,
                `
                box {
                    background-color: @view_bg_color;
                    border: 2px solid ${borderColor};
                    border-radius: 0;
                    padding: ${SPACING.SM}px;
                }
                box:hover { border-color: ${hoverColor}; }
            `
            );
        }

        /**
         * Get selected state
         * @returns {boolean} Whether card is selected
         */
        getSelected() {
            return this._selected;
        }

        // GObject property getter/setter
        get selected() {
            return this._selected;
        }

        set selected(value) {
            this.setSelected(value);
        }
    }
);
