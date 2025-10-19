import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {
    TONE_PRESETS,
    FILTER_PRESETS,
    DEFAULT_FILTERS,
} from '../../utils/image-filter-utils.js';

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

            // Filters group
            contentBox.append(this._createFiltersGroup());

            // Effects group
            contentBox.append(this._createEffectsGroup());

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

            group.add(
                this._createSliderRow(
                    'Blur',
                    'blur',
                    0,
                    5,
                    0.1,
                    0,
                    'px',
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
                description: 'Additional creative filters',
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
                this.emit('filter-changed', this._filters);
            });

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
                    this.emit('filter-changed', this._filters);
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
                this._setSliderValue('toneAmount', 0);
                this.emit('filter-changed', this._filters);
            });
            grid.append(clearButton);

            return grid;
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
