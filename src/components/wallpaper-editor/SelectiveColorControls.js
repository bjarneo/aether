import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import {SPACING} from '../../constants/ui-constants.js';

/**
 * SelectiveColorControls - HSL-style color range adjustments (like Lightroom)
 *
 * Allows independent adjustment of 8 color ranges:
 * - Reds, Oranges, Yellows, Greens, Cyans, Blues, Purples, Magentas
 *
 * For each color range, you can adjust:
 * - Hue: Shift the color within the spectrum
 * - Saturation: Make more vibrant or desaturated
 * - Lightness: Make darker or lighter
 *
 * Emits 'selective-colors-changed' signal when adjustments change
 */
export const SelectiveColorControls = GObject.registerClass(
    {
        Signals: {
            'selective-colors-changed': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class SelectiveColorControls extends Adw.PreferencesGroup {
        _init() {
            super._init({
                title: 'Selective Color Adjustment',
                description: 'Adjust specific color ranges independently',
            });

            // 8 color ranges matching Lightroom
            this._colorRanges = [
                {name: 'Reds', hueCenter: 0, hueRange: 30, color: '#ef4444'},
                {
                    name: 'Oranges',
                    hueCenter: 30,
                    hueRange: 30,
                    color: '#f97316',
                },
                {
                    name: 'Yellows',
                    hueCenter: 60,
                    hueRange: 30,
                    color: '#eab308',
                },
                {
                    name: 'Greens',
                    hueCenter: 120,
                    hueRange: 60,
                    color: '#22c55e',
                },
                {name: 'Cyans', hueCenter: 180, hueRange: 30, color: '#06b6d4'},
                {name: 'Blues', hueCenter: 240, hueRange: 60, color: '#3b82f6'},
                {
                    name: 'Purples',
                    hueCenter: 280,
                    hueRange: 30,
                    color: '#a855f7',
                },
                {
                    name: 'Magentas',
                    hueCenter: 320,
                    hueRange: 30,
                    color: '#ec4899',
                },
            ];

            // Store adjustments for each color range
            this._adjustments = {};
            // Store slider widget references for programmatic updates
            this._sliders = {};

            this._colorRanges.forEach(range => {
                this._adjustments[range.name] = {
                    hue: 0, // -180 to 180
                    saturation: 0, // -100 to 100
                    lightness: 0, // -100 to 100
                };
                // Initialize slider storage for this color range
                this._sliders[range.name] = {
                    hue: null,
                    saturation: null,
                    lightness: null,
                };
            });

            this._buildUI();
        }

        _buildUI() {
            // Create expandable rows for each color range
            this._colorRanges.forEach(range => {
                this._createColorRangeRow(range);
            });
        }

        _createColorRangeRow(range) {
            const expander = new Adw.ExpanderRow({
                title: range.name,
                subtitle: 'Adjust hue, saturation, and lightness',
            });

            // Color indicator prefix
            const colorBox = new Gtk.Box({
                width_request: 24,
                height_request: 24,
                css_classes: ['card'],
            });
            const colorProvider = new Gtk.CssProvider();
            colorProvider.load_from_data(
                `box { background: ${range.color}; border-radius: 4px; }`,
                -1
            );
            colorBox
                .get_style_context()
                .add_provider(
                    colorProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
                );
            expander.add_prefix(colorBox);

            // Hue slider
            const {row: hueRow, scale: hueScale} = this._createSliderRow(
                'Hue',
                -180,
                180,
                1,
                0,
                '°',
                'Shift color hue',
                value => {
                    this._adjustments[range.name].hue = value;
                    this._emitChange();
                }
            );
            this._sliders[range.name].hue = hueScale;
            expander.add_row(hueRow);

            // Saturation slider
            const {row: satRow, scale: satScale} = this._createSliderRow(
                'Saturation',
                -100,
                100,
                1,
                0,
                '',
                'Adjust color intensity',
                value => {
                    this._adjustments[range.name].saturation = value;
                    this._emitChange();
                }
            );
            this._sliders[range.name].saturation = satScale;
            expander.add_row(satRow);

            // Lightness slider
            const {row: lightRow, scale: lightScale} = this._createSliderRow(
                'Lightness',
                -100,
                100,
                1,
                0,
                '',
                'Adjust brightness',
                value => {
                    this._adjustments[range.name].lightness = value;
                    this._emitChange();
                }
            );
            this._sliders[range.name].lightness = lightScale;
            expander.add_row(lightRow);

            this.add(expander);
        }

        _createSliderRow(
            label,
            min,
            max,
            step,
            initialValue,
            unit,
            subtitle,
            onChange
        ) {
            const row = new Adw.ActionRow({
                title: label,
                subtitle: subtitle,
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                margin_top: 8,
                margin_bottom: 8,
            });

            const scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                draw_value: false,
                hexpand: false,
                width_request: 180,
            });
            scale.set_range(min, max);
            scale.set_increments(step, step * 5);
            scale.set_value(initialValue);

            const valueLabel = new Gtk.Label({
                label: `${Math.round(initialValue)}${unit}`,
                width_chars: 6,
                xalign: 1,
                css_classes: ['monospace', 'dimmed'],
            });

            scale.connect('value-changed', () => {
                const value = scale.get_value();
                valueLabel.set_label(`${Math.round(value)}${unit}`);
                onChange(value);
            });

            box.append(scale);
            box.append(valueLabel);
            row.add_suffix(box);

            // Return both row and scale so we can update the scale programmatically
            return {row, scale};
        }

        _emitChange() {
            // Build color range data for ImageMagick
            const colorRangeData = this._colorRanges
                .map(range => ({
                    name: range.name,
                    hueCenter: range.hueCenter,
                    hueRange: range.hueRange,
                    adjustments: this._adjustments[range.name],
                }))
                .filter(range => {
                    // Only include ranges with active adjustments
                    const adj = range.adjustments;
                    return (
                        adj.hue !== 0 ||
                        adj.saturation !== 0 ||
                        adj.lightness !== 0
                    );
                });

            console.log(
                'Selective colors changed:',
                colorRangeData.length,
                'active ranges'
            );
            this.emit('selective-colors-changed', colorRangeData);
        }

        getAdjustments() {
            return {...this._adjustments};
        }

        setAdjustments(adjustments) {
            Object.keys(adjustments).forEach(colorName => {
                if (this._adjustments[colorName]) {
                    this._adjustments[colorName] = {...adjustments[colorName]};

                    // Update UI sliders to reflect loaded values
                    const sliders = this._sliders[colorName];
                    const values = adjustments[colorName];

                    if (sliders && values) {
                        if (sliders.hue) sliders.hue.set_value(values.hue || 0);
                        if (sliders.saturation)
                            sliders.saturation.set_value(
                                values.saturation || 0
                            );
                        if (sliders.lightness)
                            sliders.lightness.set_value(values.lightness || 0);
                    }
                }
            });
        }

        clearAdjustments() {
            this._colorRanges.forEach(range => {
                this._adjustments[range.name] = {
                    hue: 0,
                    saturation: 0,
                    lightness: 0,
                };

                // Reset all UI sliders to 0
                const sliders = this._sliders[range.name];
                if (sliders) {
                    if (sliders.hue) sliders.hue.set_value(0);
                    if (sliders.saturation) sliders.saturation.set_value(0);
                    if (sliders.lightness) sliders.lightness.set_value(0);
                }
            });
            this._emitChange();
        }
    }
);
