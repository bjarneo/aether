/**
 * PresetGrid.js - Filter preset selection component
 *
 * Displays filter presets organized by category with a grid layout.
 * Used by FilterControls to allow quick preset application.
 *
 * Features:
 * - Presets organized by category (Mood, Color, Cinematic)
 * - 2-column grid layout for compact display
 * - Click to apply preset
 *
 * @module PresetGrid
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {FILTER_PRESETS} from '../../utils/image-filter-utils.js';
import {createWrapperRow} from '../../utils/ui-builders.js';
import {SPACING, GRID} from '../../constants/ui-constants.js';

/**
 * Preset categories with their associated presets
 * @type {Array<{name: string, presets: Array}>}
 */
const PRESET_CATEGORIES = [
    {
        name: 'Mood',
        presets: [
            FILTER_PRESETS[0], // Muted
            FILTER_PRESETS[1], // Dramatic
            FILTER_PRESETS[2], // Soft
            FILTER_PRESETS[4], // Vibrant
        ],
    },
    {
        name: 'Color',
        presets: [
            FILTER_PRESETS[6], // Cool
            FILTER_PRESETS[7], // Warm
            FILTER_PRESETS[3], // Vintage
            FILTER_PRESETS[5], // Faded
        ],
    },
    {
        name: 'Cinematic',
        presets: [
            FILTER_PRESETS[8], // Cinematic
            FILTER_PRESETS[9], // Film
            FILTER_PRESETS[10], // Crisp
            FILTER_PRESETS[11], // Portrait
        ],
    },
];

/**
 * PresetGrid - Grid display of filter presets organized by category
 *
 * @fires preset-selected - When a preset is clicked
 */
export const PresetGrid = GObject.registerClass(
    {
        Signals: {
            'preset-selected': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class PresetGrid extends Gtk.Box {
        /**
         * Initialize the preset grid
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
                margin_top: SPACING.MD,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            });

            this._buildUI();
        }

        /**
         * Build the preset grid UI
         * @private
         */
        _buildUI() {
            PRESET_CATEGORIES.forEach(category => {
                this.append(
                    this._createPresetCategory(category.name, category.presets)
                );
            });
        }

        /**
         * Create a preset category group with preset buttons
         * @param {string} categoryName - Name of the category
         * @param {Array} presets - Array of preset objects
         * @returns {Adw.PreferencesGroup} Category group widget
         * @private
         */
        _createPresetCategory(categoryName, presets) {
            const group = new Adw.PreferencesGroup({
                title: categoryName,
            });

            const grid = new Gtk.FlowBox({
                max_children_per_line: 2,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                homogeneous: true,
            });

            presets.forEach(preset => {
                const button = this._createPresetButton(preset);
                grid.append(button);
            });

            group.add(createWrapperRow({child: grid, addMargins: false}));
            return group;
        }

        /**
         * Create a single preset button
         * @param {Object} preset - Preset object with name and filter values
         * @returns {Gtk.Button} Preset button widget
         * @private
         */
        _createPresetButton(preset) {
            const button = new Gtk.Button({
                label: preset.name,
                height_request: 50,
                css_classes: ['card'],
            });

            button.connect('clicked', () => {
                this.emit('preset-selected', preset);
            });

            return button;
        }

        /**
         * Get all available presets
         * @returns {Array} Array of all presets across all categories
         */
        getAllPresets() {
            return FILTER_PRESETS;
        }

        /**
         * Get presets by category name
         * @param {string} categoryName - Name of the category
         * @returns {Array|null} Array of presets or null if category not found
         */
        getPresetsByCategory(categoryName) {
            const category = PRESET_CATEGORIES.find(
                c => c.name === categoryName
            );
            return category ? category.presets : null;
        }
    }
);

export default PresetGrid;
