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
const SLIDER_WIDTH = 200; // Slightly wider for better UX
const DOUBLE_CLICK_TIMEOUT_MS = 300; // Time window for detecting double-clicks

/**
 * Helper function to convert RGB (0-255) to hex color
 */
function rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

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
                spacing: 12,
                margin_top: 8,
                margin_bottom: 4,
                margin_start: 18,
                margin_end: 18,
            });

            this._activeFilterLabel = new Gtk.Label({
                label: 'No filters active',
                xalign: 0,
                hexpand: true,
                css_classes: ['dim-label'],
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
                margin_top: 12,
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
                margin_top: 12,
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

            toneGroup.add(new Adw.ActionRow({child: this._createToneGrid()}));

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
                margin_top: 12,
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

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
                margin_top: 12,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            // Mood presets (Muted, Dramatic, Soft, Vibrant)
            box.append(
                this._createPresetCategory('Mood', [
                    FILTER_PRESETS[0], // Muted
                    FILTER_PRESETS[1], // Dramatic
                    FILTER_PRESETS[2], // Soft
                    FILTER_PRESETS[4], // Vibrant
                ])
            );

            // Color presets (Cool, Warm, Vintage, Faded)
            box.append(
                this._createPresetCategory('Color', [
                    FILTER_PRESETS[6], // Cool
                    FILTER_PRESETS[7], // Warm
                    FILTER_PRESETS[3], // Vintage
                    FILTER_PRESETS[5], // Faded
                ])
            );

            // Cinematic presets (Cinematic, Film, Crisp, Portrait)
            box.append(
                this._createPresetCategory('Cinematic', [
                    FILTER_PRESETS[8], // Cinematic
                    FILTER_PRESETS[9], // Film
                    FILTER_PRESETS[10], // Crisp
                    FILTER_PRESETS[11], // Portrait
                ])
            );

            scrolled.set_child(box);
            return scrolled;
        }

        /**
         * Create a preset category group with 4 presets
         */
        _createPresetCategory(categoryName, presets) {
            const group = new Adw.PreferencesGroup({
                title: categoryName,
            });

            const grid = new Gtk.FlowBox({
                max_children_per_line: 2,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 12,
                row_spacing: 12,
                homogeneous: true,
            });

            presets.forEach(preset => {
                const button = new Gtk.Button({
                    label: preset.name,
                    height_request: 50,
                    css_classes: ['card'],
                });

                button.connect('clicked', () => {
                    this._applyPreset(preset);
                });

                grid.append(button);
            });

            group.add(new Adw.ActionRow({child: grid}));
            return group;
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
                css_classes: ['monospace', 'dim-label'],
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
         * Create the tone color picker grid
         */
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
                    this._updateActiveFilterCount();
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
                this._updateActiveFilterCount();
                this.emit('filter-changed', this._filters);
            });
            grid.append(clearButton);

            return grid;
        }

        /**
         * Open custom color picker dialog for tone
         */
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
                        this._updateActiveFilterCount();

                        this.emit('filter-changed', this._filters);
                    } catch (e) {
                        // User cancelled
                    }
                }
            );
        }

        /**
         * Update the custom color button appearance
         */
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
