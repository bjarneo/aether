/**
 * ExtendedColorControls - UI for editing extended color roles
 * Displays accent, cursor, selection_foreground, selection_background
 * Styled to match ColorPaletteDisplay visual design
 *
 * @module ExtendedColorControls
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {themeState} from '../../state/ThemeState.js';
import {rgbaToHex} from '../../utils/color-utils.js';
import {applyCssToWidget, showToast} from '../../utils/ui-helpers.js';
import {ColorPickerDialog} from './color-picker-dialog.js';

/**
 * Extended color role definitions
 * @type {Array<{id: string, label: string, shortLabel: string, description: string}>}
 */
const EXTENDED_COLOR_ROLES = [
    {
        id: 'accent',
        label: 'Accent',
        shortLabel: 'Accent',
        description: 'Accent color for highlights and interactive elements',
    },
    {
        id: 'cursor',
        label: 'Cursor',
        shortLabel: 'Cursor',
        description: 'Cursor color for text input',
    },
    {
        id: 'selection_foreground',
        label: 'Selection Text',
        shortLabel: 'Sel FG',
        description: 'Text color when selected',
    },
    {
        id: 'selection_background',
        label: 'Selection Background',
        shortLabel: 'Sel BG',
        description: 'Background color when selected',
    },
];

/**
 * ExtendedColorControls - Editable extended color roles
 * @class
 * @extends {Gtk.Box}
 */
export const ExtendedColorControls = GObject.registerClass(
    {
        Signals: {
            'color-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
            },
        },
    },
    class ExtendedColorControls extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
            });

            this._colors = {};
            this._swatches = new Map();

            this._buildUI();
            this._connectThemeState();
        }

        _buildUI() {
            // Header
            const header = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const title = new Gtk.Label({
                label: 'Extended Colors',
                xalign: 0,
                hexpand: true,
            });
            applyCssToWidget(
                title,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.7;
                }
            `
            );
            header.append(title);

            // Hint text
            const hint = new Gtk.Label({
                label: 'Click to edit · Right-click to copy',
                css_classes: ['dimmed'],
            });
            applyCssToWidget(
                hint,
                `
                label {
                    font-size: 11px;
                    opacity: 0.5;
                }
            `
            );
            header.append(hint);

            this.append(header);

            // Color row container
            const rowContainer = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
            });

            // Row label
            const rowLabel = new Gtk.Label({
                label: 'UI Colors',
                xalign: 0,
            });
            applyCssToWidget(
                rowLabel,
                `
                label {
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.4;
                    margin-left: 2px;
                }
            `
            );
            rowContainer.append(rowLabel);

            // Swatches grid
            const grid = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 2,
                homogeneous: true,
            });

            EXTENDED_COLOR_ROLES.forEach(role => {
                const swatch = this._createSwatch(role);
                grid.append(swatch);
            });

            rowContainer.append(grid);
            this.append(rowContainer);

            // Legend
            const legend = this._createLegend();
            this.append(legend);
        }

        _createSwatch(role) {
            const color = this._colors[role.id] || '#808080';

            // Overlay for swatch
            const overlay = new Gtk.Overlay({
                hexpand: true,
            });

            // Color box
            const swatch = new Gtk.Box({
                height_request: 48,
                hexpand: true,
                tooltip_text: `${role.label}\n${role.description}\n${color}`,
            });

            applyCssToWidget(
                swatch,
                `
                box {
                    background-color: ${color};
                    border-radius: 0;
                    border: 1px solid alpha(@borders, 0.2);
                }
                box:hover {
                    border: 2px solid alpha(white, 0.8);
                }
            `
            );
            swatch.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

            // Store reference for updates
            swatch._roleId = role.id;
            overlay.set_child(swatch);

            // Store swatch reference
            this._swatches.set(role.id, {overlay, swatch});

            // Click handler for color picker
            const clickGesture = new Gtk.GestureClick();
            clickGesture.connect('pressed', () => {
                this._openColorPicker(role);
            });
            swatch.add_controller(clickGesture);

            // Right-click for copy
            const rightClick = new Gtk.GestureClick({
                button: Gdk.BUTTON_SECONDARY,
            });
            rightClick.connect('pressed', () => {
                this._copyColor(role.id);
            });
            swatch.add_controller(rightClick);

            return overlay;
        }

        _createLegend() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 16,
                margin_top: 8,
            });

            EXTENDED_COLOR_ROLES.forEach(role => {
                const item = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 4,
                });

                const dot = new Gtk.Box({
                    width_request: 8,
                    height_request: 8,
                    valign: Gtk.Align.CENTER,
                });
                applyCssToWidget(
                    dot,
                    `
                    box {
                        background-color: ${this._colors[role.id] || '#808080'};
                        border-radius: 0;
                    }
                `
                );
                dot._roleId = role.id;
                item.append(dot);

                const label = new Gtk.Label({
                    label: role.shortLabel,
                    css_classes: ['dimmed'],
                });
                applyCssToWidget(
                    label,
                    `
                    label {
                        font-size: 10px;
                        opacity: 0.6;
                    }
                `
                );
                item.append(label);

                box.append(item);
            });

            this._legendBox = box;
            return box;
        }

        _openColorPicker(role) {
            const currentColor = this._colors[role.id] || '#808080';
            const palette = themeState.getPalette();

            const dialog = new ColorPickerDialog(this.get_root(), palette);
            dialog.openShadePicker(-1, currentColor, color => {
                this._colors[role.id] = color;
                themeState.setExtendedColor(role.id, color);
                this._updateSwatch(role.id, color);
                this.emit('color-changed', role.id, color);
            });
        }

        _copyColor(roleId) {
            const color = this._colors[roleId] || '#808080';
            const display = Gdk.Display.get_default();
            const clipboard = display.get_clipboard();

            const value = new GObject.Value();
            value.init(GObject.TYPE_STRING);
            value.set_string(color);

            const contentProvider = Gdk.ContentProvider.new_for_value(value);
            clipboard.set_content(contentProvider);

            const role = EXTENDED_COLOR_ROLES.find(r => r.id === roleId);
            showToast(this, `Copied ${color}`);
        }

        _updateSwatch(roleId, color) {
            const swatchData = this._swatches.get(roleId);
            if (swatchData) {
                const {swatch} = swatchData;
                applyCssToWidget(
                    swatch,
                    `
                    box {
                        background-color: ${color};
                        border-radius: 0;
                        border: 1px solid alpha(@borders, 0.2);
                    }
                    box:hover {
                        border: 2px solid alpha(white, 0.8);
                    }
                `
                );
                const role = EXTENDED_COLOR_ROLES.find(r => r.id === roleId);
                swatch.set_tooltip_text(
                    `${role.label}\n${role.description}\n${color}`
                );
            }

            // Update legend dot
            this._updateLegend();
        }

        _updateLegend() {
            if (!this._legendBox) return;

            let child = this._legendBox.get_first_child();
            while (child) {
                const dot = child.get_first_child();
                if (dot && dot._roleId) {
                    const color = this._colors[dot._roleId] || '#808080';
                    applyCssToWidget(
                        dot,
                        `
                        box {
                            background-color: ${color};
                            border-radius: 0;
                        }
                    `
                    );
                }
                child = child.get_next_sibling();
            }
        }

        _connectThemeState() {
            // Listen for color role changes
            themeState.connect('color-roles-changed', (_, colorRoles) => {
                this._updateFromColorRoles(colorRoles);
            });

            // Listen for state reset
            themeState.connect('state-reset', () => {
                this._updateFromColorRoles(themeState.getColorRoles());
            });

            // Initialize with current values
            this._updateFromColorRoles(themeState.getColorRoles());
        }

        _updateFromColorRoles(colorRoles) {
            EXTENDED_COLOR_ROLES.forEach(role => {
                const colorValue = colorRoles[role.id];
                if (colorValue && colorValue !== this._colors[role.id]) {
                    this._colors[role.id] = colorValue;
                    this._updateSwatch(role.id, colorValue);
                }
            });
        }

        /**
         * Get current extended color values
         * @returns {Object} Extended color mappings
         */
        getColors() {
            return {...this._colors};
        }
    }
);
