/**
 * ToneColorPicker.js - Color tone selection component
 *
 * Provides a grid of preset tone colors plus a custom color picker.
 * Used by FilterControls for applying color tones to images.
 *
 * Features:
 * - 8 preset tone colors (Blue, Cyan, Green, Yellow, Orange, Red, Pink, Purple)
 * - Custom color picker with HSL support
 * - Clear button to remove tone
 * - Visual indicator for selected color
 *
 * @module ToneColorPicker
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {TONE_PRESETS} from '../../utils/image-filter-utils.js';
import {rgbToHsl, hslToHex} from '../../utils/color-utils.js';

/**
 * ToneColorPicker - Grid of tone color presets with custom picker
 *
 * @fires tone-selected - When a tone color is selected (hue value or null)
 */
export const ToneColorPicker = GObject.registerClass(
    {
        Signals: {
            'tone-selected': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class ToneColorPicker extends Gtk.FlowBox {
        /**
         * Initialize the tone color picker
         * @param {Object} [options={}] - Options
         * @param {number|null} [options.initialTone=null] - Initial tone hue value
         * @param {number} [options.initialSaturation=100] - Initial saturation
         * @param {number} [options.initialLightness=50] - Initial lightness
         */
        _init(options = {}) {
            super._init({
                max_children_per_line: 4,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 8,
                row_spacing: 8,
                margin_top: 8,
                margin_bottom: 8,
            });

            this._currentTone = options.initialTone ?? null;
            this._currentSaturation = options.initialSaturation ?? 100;
            this._currentLightness = options.initialLightness ?? 50;
            this._customColorButton = null;

            this._buildUI();
        }

        /**
         * Build the tone picker UI
         * @private
         */
        _buildUI() {
            // Add preset tone buttons
            TONE_PRESETS.forEach(tone => {
                const button = this._createToneButton(tone);
                this.append(button);
            });

            // Add custom color picker button
            this._customColorButton = this._createCustomColorButton();
            this.append(this._customColorButton);

            // Add clear button
            const clearButton = this._createClearButton();
            this.append(clearButton);

            // Update custom button appearance
            this._updateCustomColorButton();
        }

        /**
         * Create a preset tone button
         * @param {Object} tone - Tone preset object with name, color, and hue
         * @returns {Gtk.Button} Tone button widget
         * @private
         */
        _createToneButton(tone) {
            const button = new Gtk.Button({
                width_request: 52,
                height_request: 36,
                tooltip_text: `${tone.name} tone`,
            });

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
                this._currentTone = tone.hue;
                this._currentSaturation = 100;
                this._currentLightness = 50;
                this._updateCustomColorButton();
                this._emitToneSelected();
            });

            return button;
        }

        /**
         * Create the custom color picker button
         * @returns {Gtk.Button} Custom color button widget
         * @private
         */
        _createCustomColorButton() {
            const button = new Gtk.Button({
                icon_name: 'color-select-symbolic',
                width_request: 52,
                height_request: 36,
                tooltip_text: 'Pick custom tone color',
            });

            button.connect('clicked', () => {
                this._openCustomColorPicker();
            });

            return button;
        }

        /**
         * Create the clear button
         * @returns {Gtk.Button} Clear button widget
         * @private
         */
        _createClearButton() {
            const button = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                width_request: 52,
                height_request: 36,
                tooltip_text: 'Clear tone',
            });

            button.connect('clicked', () => {
                this._currentTone = null;
                this._updateCustomColorButton();
                this._emitToneSelected();
            });

            return button;
        }

        /**
         * Open the custom color picker dialog
         * @private
         */
        _openCustomColorPicker() {
            const colorDialog = new Gtk.ColorDialog();

            // Set initial color if one is selected
            let initialColor = new Gdk.RGBA();
            if (this._currentTone !== null) {
                const hexColor = hslToHex(
                    this._currentTone,
                    this._currentSaturation,
                    this._currentLightness
                );
                initialColor.parse(hexColor);
            } else {
                // Default to blue
                initialColor.red = 0.5;
                initialColor.green = 0.5;
                initialColor.blue = 1.0;
                initialColor.alpha = 1.0;
            }

            colorDialog.choose_rgba(
                this.get_root(),
                initialColor,
                null,
                (dialog, result) => {
                    try {
                        const color = dialog.choose_rgba_finish(result);

                        // Convert RGBA to HSL
                        const r = color.red * 255;
                        const g = color.green * 255;
                        const b = color.blue * 255;
                        const hsl = rgbToHsl(r, g, b);

                        // Store full HSL values
                        this._currentTone = Math.round(hsl.h);
                        this._currentSaturation = Math.round(hsl.s);
                        this._currentLightness = Math.round(hsl.l);

                        this._updateCustomColorButton();
                        this._emitToneSelected();
                    } catch (e) {
                        // User cancelled - do nothing
                    }
                }
            );
        }

        /**
         * Update the custom color button appearance
         * @private
         */
        _updateCustomColorButton() {
            if (!this._customColorButton) return;

            if (this._currentTone !== null) {
                // Show the selected color as background
                const hexColor = hslToHex(
                    this._currentTone,
                    this._currentSaturation,
                    this._currentLightness
                );
                const css = `* {
                    background: ${hexColor};
                    border: 2px solid alpha(white, 0.2);
                    min-width: 52px;
                    min-height: 36px;
                }
                *:hover {
                    border: 2px solid white;
                    transform: scale(1.05);
                }`;
                applyCssToWidget(this._customColorButton, css);
                // Remove icon when showing color
                this._customColorButton.set_icon_name(null);
            } else {
                // Reset to default icon appearance
                applyCssToWidget(this._customColorButton, '');
                this._customColorButton.set_icon_name('color-select-symbolic');
            }
        }

        /**
         * Emit the tone-selected signal with current values
         * @private
         */
        _emitToneSelected() {
            this.emit('tone-selected', {
                tone: this._currentTone,
                saturation: this._currentSaturation,
                lightness: this._currentLightness,
            });
        }

        /**
         * Get the current tone value
         * @returns {number|null} Current tone hue (0-360) or null if no tone
         */
        getTone() {
            return this._currentTone;
        }

        /**
         * Get the full tone configuration
         * @returns {Object} Object with tone, saturation, and lightness
         */
        getToneConfig() {
            return {
                tone: this._currentTone,
                saturation: this._currentSaturation,
                lightness: this._currentLightness,
            };
        }

        /**
         * Set the tone programmatically
         * @param {number|null} tone - Tone hue value (0-360) or null to clear
         * @param {number} [saturation=100] - Saturation value (0-100)
         * @param {number} [lightness=50] - Lightness value (0-100)
         */
        setTone(tone, saturation = 100, lightness = 50) {
            this._currentTone = tone;
            this._currentSaturation = saturation;
            this._currentLightness = lightness;
            this._updateCustomColorButton();
        }

        /**
         * Clear the current tone selection
         */
        clearTone() {
            this._currentTone = null;
            this._updateCustomColorButton();
            this._emitToneSelected();
        }
    }
);

export default ToneColorPicker;
