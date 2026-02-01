/**
 * FilterSliderRow.js - Reusable filter slider component
 *
 * Creates an Adw.ActionRow with a slider control for filter adjustment.
 * Includes value display, double-click to reset, and proper styling.
 *
 * Features:
 * - Consistent slider styling and dimensions
 * - Value label with unit suffix
 * - Double-click to reset to default value
 * - Signal emission on value change
 *
 * @module FilterSliderRow
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GLib from 'gi://GLib';

import {SLIDER, TIMING} from '../../constants/ui-constants.js';

/**
 * FilterSliderRow - Action row with slider control for filter values
 *
 * @fires value-changed - When the slider value changes
 */
export const FilterSliderRow = GObject.registerClass(
    {
        Signals: {
            'value-changed': {
                param_types: [GObject.TYPE_DOUBLE],
            },
        },
        Properties: {
            'filter-key': GObject.ParamSpec.string(
                'filter-key',
                'Filter Key',
                'The key identifying this filter',
                GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
                ''
            ),
        },
    },
    class FilterSliderRow extends Adw.ActionRow {
        /**
         * Initialize the filter slider row
         * @param {Object} config - Slider configuration
         * @param {string} config.title - Row title
         * @param {string} config.key - Filter key identifier
         * @param {number} config.min - Minimum value
         * @param {number} config.max - Maximum value
         * @param {number} config.step - Step increment
         * @param {number} config.defaultValue - Default value
         * @param {string} [config.unit=''] - Unit suffix (%, px, etc.)
         * @param {string} [config.subtitle=''] - Row subtitle/description
         * @param {number} [config.width] - Slider width (default from UI constants)
         */
        _init(config) {
            const {
                title,
                key,
                min,
                max,
                step,
                defaultValue,
                unit = '',
                subtitle = '',
                width = SLIDER.WIDTH,
            } = config;

            super._init({
                title,
                subtitle,
            });

            this._key = key;
            this._min = min;
            this._max = max;
            this._step = step;
            this._defaultValue = defaultValue;
            this._unit = unit;
            this._currentValue = defaultValue;

            this._buildUI(width);
        }

        /**
         * Build the slider UI
         * @param {number} width - Slider width
         * @private
         */
        _buildUI(width) {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 16,
                margin_top: 14,
                margin_bottom: 14,
                margin_start: 8,
                margin_end: 8,
            });

            // Create scale
            this._scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                draw_value: false,
                hexpand: false,
                width_request: width,
            });
            this._scale.set_range(this._min, this._max);
            this._scale.set_increments(this._step, this._step * 5);
            this._scale.set_value(this._defaultValue);

            // Create value label
            this._valueLabel = new Gtk.Label({
                label: this._formatValue(this._defaultValue),
                width_chars: SLIDER.VALUE_LABEL_CHARS,
                xalign: 1,
                css_classes: ['monospace', 'dimmed'],
            });

            // Connect value change
            this._scale.connect('value-changed', () => {
                const value = this._scale.get_value();
                this._currentValue = value;
                this._valueLabel.set_label(this._formatValue(value));
                this.emit('value-changed', value);
            });

            // Add double-click to reset gesture
            this._setupDoubleClickReset();

            box.append(this._scale);
            box.append(this._valueLabel);
            this.add_suffix(box);
        }

        /**
         * Set up double-click gesture to reset slider
         * @private
         */
        _setupDoubleClickReset() {
            let clickCount = 0;
            let clickTimeout = null;

            const gesture = new Gtk.GestureClick();
            gesture.connect('pressed', () => {
                clickCount++;

                if (clickTimeout) {
                    GLib.source_remove(clickTimeout);
                }

                clickTimeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    TIMING.DOUBLE_CLICK,
                    () => {
                        if (clickCount === 2) {
                            this.reset();
                        }
                        clickCount = 0;
                        clickTimeout = null;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });

            this._scale.add_controller(gesture);
        }

        /**
         * Format the value for display
         * @param {number} value - Value to format
         * @returns {string} Formatted value string
         * @private
         */
        _formatValue(value) {
            return `${Math.round(value)}${this._unit}`;
        }

        /**
         * Get the current value
         * @returns {number} Current slider value
         */
        getValue() {
            return this._currentValue;
        }

        /**
         * Set the slider value
         * @param {number} value - New value
         * @param {boolean} [emitSignal=true] - Whether to emit value-changed signal
         */
        setValue(value, emitSignal = true) {
            this._currentValue = value;
            this._scale.set_value(value);
            this._valueLabel.set_label(this._formatValue(value));

            if (emitSignal) {
                this.emit('value-changed', value);
            }
        }

        /**
         * Reset to default value
         * @param {boolean} [emitSignal=true] - Whether to emit value-changed signal
         */
        reset(emitSignal = true) {
            this.setValue(this._defaultValue, emitSignal);
        }

        /**
         * Get the filter key
         * @returns {string} Filter key identifier
         */
        getKey() {
            return this._key;
        }

        /**
         * Get the default value
         * @returns {number} Default value
         */
        getDefaultValue() {
            return this._defaultValue;
        }

        /**
         * Check if the current value differs from default
         * @returns {boolean} True if value has been modified
         */
        isModified() {
            return this._currentValue !== this._defaultValue;
        }

        /**
         * Get the scale widget (for adding to tint row, etc.)
         * @returns {Gtk.Scale} The scale widget
         */
        getScale() {
            return this._scale;
        }
    }
);

/**
 * Helper function to create a FilterSliderRow with common configuration
 * @param {Object} config - Slider configuration
 * @returns {FilterSliderRow} New filter slider row
 */
export function createFilterSlider(config) {
    return new FilterSliderRow(config);
}

export default FilterSliderRow;
