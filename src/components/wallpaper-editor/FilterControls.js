import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GLib from 'gi://GLib';

import {createWrapperRow} from '../../utils/ui-builders.js';
import {
    FILTER_PRESETS,
    DEFAULT_FILTERS,
} from '../../utils/image-filter-utils.js';
import {SPACING, GRID} from '../../constants/ui-constants.js';
import {ToneColorPicker} from './ToneColorPicker.js';
import {PresetGrid} from './PresetGrid.js';

// UI constants
const SLIDER_WIDTH = 200; // Slightly wider for better UX
const DOUBLE_CLICK_TIMEOUT_MS = 300; // Time window for detecting double-clicks

/**
 * FilterControls - Tabbed UI controls for adjusting image filters
 *
 * Reorganized into 4 tabs for better usability:
 * - Simple: 6 most common adjustments
 * - Creative: Artistic effects and filters
 * - Pro: Advanced professional controls
 * - Presets: Quick preset library organized by category
 *
 * Features:
 * - Visual active filter indicators (colored badges)
 * - Per-tab and global reset buttons
 * - Active filter count in UI
 * - Improved preset grid with categories
 *
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
    class FilterControls extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                vexpand: true,
            });

            this._sliders = {};
            this._filters = {...DEFAULT_FILTERS};
            this._tintColorButton = null;
            this._customColorButton = null;
            this._activeFilterLabel = null;

            this._buildUI();
        }

        _buildUI() {
            // Active filter indicator at top
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                margin_top: 8,
                margin_bottom: 4,
                margin_start: 18,
                margin_end: 18,
            });

            this._activeFilterLabel = new Gtk.Label({
                label: 'No filters active',
                xalign: 0,
                hexpand: true,
                css_classes: ['dimmed'],
            });
            headerBox.append(this._activeFilterLabel);

            // Global reset button
            const resetAllBtn = new Gtk.Button({
                icon_name: 'edit-clear-all-symbolic',
                tooltip_text: 'Reset all filters',
                css_classes: ['flat'],
            });
            resetAllBtn.connect('clicked', () => {
                this._resetAllFilters();
            });
            headerBox.append(resetAllBtn);

            this.append(headerBox);

            // Tab view for different filter categories
            const tabView = new Adw.TabView({
                vexpand: true,
            });

            const tabBar = new Adw.TabBar({
                view: tabView,
                autohide: false,
            });
            this.append(tabBar);
            this.append(tabView);

            // Tab 1: Simple (most common filters)
            tabView.append(this._createSimpleTab()).set_title('Simple');

            // Tab 2: Creative (artistic effects)
            tabView.append(this._createCreativeTab()).set_title('Creative');

            // Tab 3: Pro (advanced controls)
            tabView.append(this._createProTab()).set_title('Pro');

            // Tab 4: Presets (quick presets library)
            tabView.append(this._createPresetsTab()).set_title('Presets');
        }

        /**
         * Simple Tab - Most common 6 filters for beginners
         */
        _createSimpleTab() {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                margin_top: SPACING.MD,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            const group = new Adw.PreferencesGroup({
                title: 'Essential Adjustments',
                description: 'The most commonly used filters',
            });

            group.add(
                this._createSliderRow(
                    'Brightness',
                    'brightness',
                    50,
                    150,
                    1,
                    100,
                    '%',
                    'Make image lighter or darker'
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
                    'Adjust difference between light and dark'
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
                    'Control color intensity (0% = grayscale)'
                )
            );

            group.add(
                this._createSliderRow(
                    'Blur',
                    'blur',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Soften and smooth the image'
                )
            );

            group.add(
                this._createSliderRow(
                    'Sharpen',
                    'sharpen',
                    0,
                    100,
                    1,
                    0,
                    '',
                    'Enhance edges and details'
                )
            );

            group.add(
                this._createSliderRow(
                    'Vignette',
                    'vignette',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Darken edges to draw focus to center'
                )
            );

            box.append(group);
            scrolled.set_child(box);
            return scrolled;
        }

        /**
         * Creative Tab - Artistic effects and creative filters
         */
        _createCreativeTab() {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 20,
                margin_top: SPACING.MD,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            // Artistic Effects
            const effectsGroup = new Adw.PreferencesGroup({
                title: 'Artistic Effects',
                description: 'Creative and stylistic filters',
            });

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

            effectsGroup.add(
                this._createSliderRow(
                    'Grain',
                    'grain',
                    0,
                    10,
                    0.1,
                    0,
                    '',
                    'Add film-like texture'
                )
            );

            effectsGroup.add(
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

            effectsGroup.add(
                this._createSliderRow(
                    'Pixelate',
                    'pixelate',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Create retro pixel art look'
                )
            );

            effectsGroup.add(
                this._createSliderRow(
                    'Invert',
                    'invert',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Invert all colors (negative effect)'
                )
            );

            box.append(effectsGroup);

            // Color Tone System
            const toneGroup = new Adw.PreferencesGroup({
                title: 'Color Tone',
                description: 'Apply color wash over image',
            });

            // Use ToneColorPicker component
            this._toneColorPicker = new ToneColorPicker({
                initialTone: this._filters.tone,
                initialSaturation: this._filters.toneSaturation || 100,
                initialLightness: this._filters.toneLightness || 50,
            });
            this._toneColorPicker.connect('tone-selected', (_, toneData) => {
                this._onToneSelected(toneData);
            });
            toneGroup.add(
                createWrapperRow({
                    child: this._toneColorPicker,
                    addMargins: false,
                })
            );

            toneGroup.add(
                this._createSliderRow(
                    'Tone Intensity',
                    'toneAmount',
                    0,
                    100,
                    1,
                    0,
                    '%',
                    'Strength of color tone effect'
                )
            );

            box.append(toneGroup);

            scrolled.set_child(box);
            return scrolled;
        }

        /**
         * Handle tone selection from ToneColorPicker
         * @param {Object} toneData - Tone data (hue, saturation, lightness, or null)
         * @private
         */
        _onToneSelected(toneData) {
            if (toneData === null || toneData.hue === null) {
                // Clear tone
                this._filters.tone = null;
                this._setSliderValue('toneAmount', 0);
            } else {
                // Set tone
                this._filters.tone = toneData.hue;
                this._filters.toneSaturation = toneData.saturation || 100;
                this._filters.toneLightness = toneData.lightness || 50;
                // Auto-set amount to 30% if it's 0
                if (this._filters.toneAmount === 0) {
                    this._setSliderValue('toneAmount', 30);
                }
            }
            this._updateActiveFilterCount();
            this.emit('filter-changed', this._filters);
        }

        /**
         * Pro Tab - Advanced professional controls
         */
        _createProTab() {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 20,
                margin_top: SPACING.MD,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            // Color Grading
            const colorGroup = new Adw.PreferencesGroup({
                title: 'Color Grading',
                description: 'Professional color adjustments',
            });

            colorGroup.add(
                this._createSliderRow(
                    'Exposure',
                    'exposure',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Simulate camera exposure compensation'
                )
            );

            colorGroup.add(
                this._createSliderRow(
                    'Hue Shift',
                    'hueRotate',
                    0,
                    360,
                    1,
                    0,
                    '°',
                    'Rotate all colors around the color wheel'
                )
            );

            colorGroup.add(
                this._createSliderRow(
                    'Shadows',
                    'shadows',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Lift (lighten) or crush (darken) shadow areas'
                )
            );

            colorGroup.add(
                this._createSliderRow(
                    'Highlights',
                    'highlights',
                    -100,
                    100,
                    1,
                    0,
                    '',
                    'Recover or blow out bright areas'
                )
            );

            box.append(colorGroup);

            // Tint Effect
            const tintGroup = new Adw.PreferencesGroup({
                title: 'Tint',
                description: 'Apply custom color overlay',
            });

            const tintRow = this._createSliderRow(
                'Tint Amount',
                'tint',
                0,
                100,
                1,
                0,
                '%',
                'Strength of color overlay'
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
            tintGroup.add(tintRow);

            box.append(tintGroup);

            scrolled.set_child(box);
            return scrolled;
        }

        /**
         * Presets Tab - Quick preset library organized by category
         */
        _createPresetsTab() {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            const presetGrid = new PresetGrid();
            presetGrid.connect('preset-selected', (_, preset) => {
                this._applyPreset(preset);
            });

            scrolled.set_child(presetGrid);
            return scrolled;
        }

        /**
         * Create a slider row for a filter
         */
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
                css_classes: ['monospace', 'dimmed'],
            });

            scale.connect('value-changed', () => {
                const value = scale.get_value();
                this._filters[key] = value;
                valueLabel.set_label(`${Math.round(value)}${unit}`);
                this._updateActiveFilterCount();
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

        /**
         * Update active filter count label
         */
        _updateActiveFilterCount() {
            if (!this._activeFilterLabel) return;

            let activeCount = 0;

            // Count non-default slider values
            Object.keys(this._sliders).forEach(key => {
                const {defaultValue} = this._sliders[key];
                if (this._filters[key] !== defaultValue) {
                    activeCount++;
                }
            });

            // Check tone
            if (this._filters.tone !== null && this._filters.toneAmount > 0) {
                activeCount++;
            }

            if (activeCount === 0) {
                this._activeFilterLabel.set_label('No filters active');
            } else if (activeCount === 1) {
                this._activeFilterLabel.set_label('1 filter active');
            } else {
                this._activeFilterLabel.set_label(
                    `${activeCount} filters active`
                );
            }
        }

        /**
         * Set slider value programmatically
         */
        _setSliderValue(key, value) {
            if (!this._sliders[key]) return;

            this._filters[key] = value;
            const {scale, valueLabel, unit} = this._sliders[key];
            scale.set_value(value);
            valueLabel.set_label(`${Math.round(value)}${unit}`);
        }

        /**
         * Apply a filter preset
         */
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

            this._updateActiveFilterCount();
            this.emit('preset-applied', this._filters);
        }

        /**
         * Reset all filters to defaults
         */
        _resetAllFilters() {
            Object.keys(this._sliders).forEach(key => {
                const {defaultValue} = this._sliders[key];
                this._setSliderValue(key, defaultValue);
            });

            // Reset tone
            this._filters.tone = null;
            this._updateCustomColorButton();

            this._updateActiveFilterCount();
            this.emit('reset-filters');
        }

        /**
         * Get current filter values
         */
        getFilters() {
            return {...this._filters};
        }

        /**
         * Set filter values programmatically
         */
        setFilters(filters) {
            Object.keys(filters).forEach(key => {
                if (this._sliders[key] !== undefined) {
                    this._setSliderValue(key, filters[key]);
                } else {
                    this._filters[key] = filters[key];
                }
            });
            this._updateActiveFilterCount();
        }

        /**
         * Public method to reset filters (called from parent)
         */
        resetFilters() {
            this._resetAllFilters();
        }
    }
);
