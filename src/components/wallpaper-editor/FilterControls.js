import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {
    TONE_PRESETS,
    FILTER_PRESETS,
    DEFAULT_FILTERS,
} from '../../utils/image-filter-utils.js';
import {rgbToHsl, hslToHex} from '../../utils/color-utils.js';

// UI constants
const SLIDER_WIDTH = 180; // Fixed width for all filter sliders
const DOUBLE_CLICK_TIMEOUT_MS = 300; // Time window for detecting double-clicks

/**
 * Helper function to convert RGB (0-255) to hex color
 */
function rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * FilterControls - UI controls for adjusting image filters
 * Emits 'filter-changed' signal when any filter value changes
 */
export const FilterControls = GObject.registerClass(
    {
        Signals: {
            'filter-changed': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'preset-applied': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'reset-filters': {},
        },
    },
    class FilterControls extends Gtk.ScrolledWindow {
        _init() {
            super._init({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            this._sliders = {};
            this._filters = {...DEFAULT_FILTERS};
            this._tintColorButton = null;

            this._buildUI();
        }

        _buildUI() {
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                margin_top: 12,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            // Quick presets group - MOVED TO TOP
            contentBox.append(this._createPresetsGroup());

            // Basic Filters group
            contentBox.append(this._createFiltersGroup());

            // Effects group
            contentBox.append(this._createEffectsGroup());

            // Tier 1: Advanced Filters (collapsible)
            contentBox.append(this._createAdvancedFiltersGroup());

            // Color tone group
            contentBox.append(this._createToneGroup());

            this.set_child(contentBox);
        }

        _createFiltersGroup() {
            const group = new Adw.PreferencesGroup({
                title: 'Basic Adjustments',
                description: 'Fundamental color and tone controls',
            });

            group.add(
                this._createSliderRow(
                    'Blur',
                    'blur',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Soften the image'
                )
            );

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

            return group;
        }

        _createEffectsGroup() {
            const group = new Adw.PreferencesGroup({
                title: 'Effects',
                description: 'Creative and artistic filters',
            });

            group.add(
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

            group.add(
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

            group.add(
                this._createSliderRow(
                    'Oil Paint',
                    'oilPaint',
                    0,
                    10,
                    0.1,
                    0,
                    '',
                    'Painterly artistic effect'
                )
            );

            return group;
        }

        _createAdvancedFiltersGroup() {
            const group = new Adw.PreferencesGroup({
                title: 'Advanced',
                description: 'Professional-grade adjustments',
            });

            // Exposure
            group.add(
                this._createSliderRow(
                    'Exposure',
                    'exposure',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Simulate camera exposure'
                )
            );

            // Sharpen
            group.add(
                this._createSliderRow(
                    'Sharpen',
                    'sharpen',
                    0,
                    100,
                    1,
                    0,
                    '',
                    'Increase image sharpness'
                )
            );

            // Vignette
            group.add(
                this._createSliderRow(
                    'Vignette',
                    'vignette',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Darken edges for focus'
                )
            );

            // Grain
            group.add(
                this._createSliderRow(
                    'Grain',
                    'grain',
                    0,
                    10,
                    0.1,
                    0,
                    '',
                    'Add film-like grain texture'
                )
            );

            // Shadows
            group.add(
                this._createSliderRow(
                    'Shadows',
                    'shadows',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Lift or crush shadow detail'
                )
            );

            // Highlights
            group.add(
                this._createSliderRow(
                    'Highlights',
                    'highlights',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Recover or blow out highlights'
                )
            );

            // Tint/Colorize with color picker
            const tintRow = this._createSliderRow(
                'Tint',
                'tint',
                0,
                100,
                1,
                0,
                '%',
                'Overlay a color wash'
            );

            // Add color picker button to tint row
            this._tintColorButton = new Gtk.ColorButton({
                rgba: new Gdk.RGBA({
                    red: 59 / 255,
                    green: 130 / 255,
                    blue: 246 / 255,
                    alpha: 1.0,
                }),
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose tint color',
            });

            this._tintColorButton.connect('color-set', () => {
                const color = this._tintColorButton.get_rgba();
                const r = Math.round(color.red * 255);
                const g = Math.round(color.green * 255);
                const b = Math.round(color.blue * 255);
                this._filters.tintColor = rgbToHex(r, g, b);
                this.emit('filter-changed', this._filters);
            });

            tintRow.add_suffix(this._tintColorButton);
            group.add(tintRow);

            return group;
        }

        _createToneGroup() {
            const group = new Adw.PreferencesGroup({
                title: 'Color Tone',
                description: 'Apply a color tone to the image',
            });

            // Tone selector with color buttons
            const toneRow = new Adw.ActionRow({
                title: 'Tone Preset',
            });

            const toneGrid = this._createToneGrid();
            toneRow.add_suffix(toneGrid);
            group.add(toneRow);

            // Tone amount slider
            group.add(
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

            return group;
        }

        _createPresetsGroup() {
            const group = new Adw.PreferencesGroup({
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

            // First row of presets (4 buttons)
            const presetButtonBox1 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                homogeneous: true,
            });

            for (let i = 0; i < 4 && i < FILTER_PRESETS.length; i++) {
                const preset = FILTER_PRESETS[i];
                const btn = new Gtk.Button({
                    label: preset.name,
                    hexpand: true,
                });
                btn.connect('clicked', () => this._applyPreset(preset));
                presetButtonBox1.append(btn);
            }

            presetsBox.append(presetButtonBox1);

            // Second row of presets (4 buttons)
            if (FILTER_PRESETS.length > 4) {
                const presetButtonBox2 = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8,
                    homogeneous: true,
                });

                for (let i = 4; i < 8 && i < FILTER_PRESETS.length; i++) {
                    const preset = FILTER_PRESETS[i];
                    const btn = new Gtk.Button({
                        label: preset.name,
                        hexpand: true,
                    });
                    btn.connect('clicked', () => this._applyPreset(preset));
                    presetButtonBox2.append(btn);
                }

                presetsBox.append(presetButtonBox2);
            }

            // Third row of presets (4 buttons)
            if (FILTER_PRESETS.length > 8) {
                const presetButtonBox3 = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8,
                    homogeneous: true,
                });

                for (let i = 8; i < 12 && i < FILTER_PRESETS.length; i++) {
                    const preset = FILTER_PRESETS[i];
                    const btn = new Gtk.Button({
                        label: preset.name,
                        hexpand: true,
                    });
                    btn.connect('clicked', () => this._applyPreset(preset));
                    presetButtonBox3.append(btn);
                }

                presetsBox.append(presetButtonBox3);
            }

            group.add(new Adw.ActionRow({child: presetsBox}));

            return group;
        }

        _createSliderRow(
            title,
            key,
            min,
            max,
            step,
            defaultValue,
            unit,
            subtitle
        ) {
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
                hexpand: false,
                width_request: SLIDER_WIDTH,
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
                this.emit('filter-changed', this._filters);
            });

            // Double-click scale to reset to default
            let clickCount = 0;
            let clickTimeout = null;

            const scaleGesture = new Gtk.GestureClick();
            scaleGesture.connect('pressed', () => {
                clickCount++;

                if (clickTimeout) GLib.source_remove(clickTimeout);

                clickTimeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    DOUBLE_CLICK_TIMEOUT_MS,
                    () => {
                        if (clickCount === 2) {
                            scale.set_value(defaultValue);
                        }
                        clickCount = 0;
                        clickTimeout = null;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
            scale.add_controller(scaleGesture);

            box.append(scale);
            box.append(valueLabel);
            row.add_suffix(box);

            // Store for reset and programmatic updates
            this._sliders[key] = {scale, valueLabel, defaultValue, unit};

            return row;
        }

        _createToneGrid() {
            const grid = new Gtk.FlowBox({
                max_children_per_line: 4,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 8,
                row_spacing: 8,
                margin_top: 8,
                margin_bottom: 8,
            });

            TONE_PRESETS.forEach(tone => {
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
                    this._filters.tone = tone.hue;
                    // Auto-set amount to 30% if it's 0
                    if (this._filters.toneAmount === 0) {
                        this._setSliderValue('toneAmount', 30);
                    }
                    // Update custom color button to show this color too
                    this._updateCustomColorButton();
                    this.emit('filter-changed', this._filters);
                });

                grid.append(button);
            });

            // Custom color button
            this._customColorButton = new Gtk.Button({
                icon_name: 'color-select-symbolic',
                width_request: 52,
                height_request: 36,
                tooltip_text: 'Pick custom tone color',
            });
            this._customColorButton.connect('clicked', () => {
                this._openCustomColorPicker();
            });
            grid.append(this._customColorButton);

            // Update custom button appearance if there's a selected tone
            this._updateCustomColorButton();

            // Clear button
            const clearButton = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                width_request: 52,
                height_request: 36,
                tooltip_text: 'Clear tone',
            });
            clearButton.connect('clicked', () => {
                this._filters.tone = null;
                this._setSliderValue('toneAmount', 0);
                this._updateCustomColorButton();
                this.emit('filter-changed', this._filters);
            });
            grid.append(clearButton);

            return grid;
        }

        _openCustomColorPicker() {
            const colorDialog = new Gtk.ColorDialog();

            // Set initial color if one is selected
            let initialColor = new Gdk.RGBA();
            if (this._filters.tone !== null) {
                // Convert HSL to RGB using existing utility with stored values
                const s = this._filters.toneSaturation || 100;
                const l = this._filters.toneLightness || 50;
                const hexColor = hslToHex(this._filters.tone, s, l);
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

                        // Convert RGBA to HSL using existing utility
                        const r = color.red * 255;
                        const g = color.green * 255;
                        const b = color.blue * 255;
                        const hsl = rgbToHsl(r, g, b);

                        // Store full HSL values for accurate color representation
                        this._filters.tone = Math.round(hsl.h);
                        this._filters.toneSaturation = Math.round(hsl.s);
                        this._filters.toneLightness = Math.round(hsl.l);

                        // Auto-set amount to 30% if it's 0
                        if (this._filters.toneAmount === 0) {
                            this._setSliderValue('toneAmount', 30);
                        }

                        // Update the custom color button to show the selected color
                        this._updateCustomColorButton();

                        this.emit('filter-changed', this._filters);
                    } catch (e) {
                        // User cancelled
                    }
                }
            );
        }

        _updateCustomColorButton() {
            if (!this._customColorButton) return;

            if (this._filters.tone !== null) {
                // Show the selected color as background using stored HSL values
                const s = this._filters.toneSaturation || 100;
                const l = this._filters.toneLightness || 50;
                const hexColor = hslToHex(this._filters.tone, s, l);
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

        _setSliderValue(key, value) {
            if (!this._sliders[key]) return;

            this._filters[key] = value;
            const {scale, valueLabel, unit} = this._sliders[key];
            scale.set_value(value);
            valueLabel.set_label(`${Math.round(value)}${unit}`);
        }

        _applyPreset(preset) {
            // First, reset all sliders to default values
            Object.keys(this._sliders).forEach(key => {
                const {defaultValue} = this._sliders[key];
                this._setSliderValue(key, defaultValue);
            });

            // Then apply the preset values
            Object.keys(preset).forEach(key => {
                if (key !== 'name' && this._sliders[key]) {
                    this._setSliderValue(key, preset[key]);
                }
            });

            // Reset tone to null (not in sliders)
            this._filters.tone = null;

            this.emit('preset-applied', this._filters);
        }

        _resetFilters() {
            Object.keys(this._sliders).forEach(key => {
                const {defaultValue} = this._sliders[key];
                this._setSliderValue(key, defaultValue);
            });
            this.emit('reset-filters');
        }

        getFilters() {
            return {...this._filters};
        }

        setFilters(filters) {
            Object.keys(filters).forEach(key => {
                if (this._sliders[key] !== undefined) {
                    this._setSliderValue(key, filters[key]);
                } else {
                    this._filters[key] = filters[key];
                }
            });
        }
    }
);
