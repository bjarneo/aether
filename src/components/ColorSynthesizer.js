import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {rgbaToHex} from '../utils/color-utils.js';
import {applyCssToWidget, forEachChild} from '../utils/ui-helpers.js';
import {ANSI_COLOR_ROLES, DEFAULT_COLORS} from '../constants/colors.js';
import {themeState} from '../state/ThemeState.js';

/**
 * ColorSynthesizer - Color role assignment interface
 *
 * Displays and manages color assignments for theme roles (background, foreground, black, red, etc.).
 * Provides a list of color roles with interactive color pickers for each role.
 *
 * Features:
 * - 18 color roles (background, foreground, black, red, green, yellow, blue, magenta, cyan, white, bright_*)
 * - Color picker button for each role
 * - Auto-assignment when palette is loaded
 * - Manual adjustment via Gtk.ColorDialogButton
 * - Real-time color updates with signal emission
 * - Integration with centralized ThemeState
 *
 * Color Roles:
 * - background: Terminal/window background color
 * - foreground: Default text color
 * - black, red, green, yellow, blue, magenta, cyan, white: Regular ANSI colors
 * - bright_black, bright_red, etc.: Bright ANSI colors
 *
 * Signals:
 * - 'color-changed' (roleId: string, hexColor: string) - Emitted when any color is modified
 *
 * @class ColorSynthesizer
 * @extends {Gtk.Box}
 */
export const ColorSynthesizer = GObject.registerClass(
    {
        Signals: {
            'color-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
            },
        },
    },
    class ColorSynthesizer extends Gtk.Box {
        /**
         * Initializes ColorSynthesizer with role list and default colors
         * Creates color picker rows for all ANSI color roles
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._palette = [];
            this._colorRoles = new Map();

            this._listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE,
                css_classes: ['boxed-list'],
            });

            ANSI_COLOR_ROLES.forEach(role => {
                const row = this._createColorRoleRow(role);
                this._listBox.append(row);
            });

            this.append(this._listBox);
            this._initializeDefaults();
            this._connectThemeState();
        }

        /**
         * Connect to centralized theme state signals
         * @private
         */
        _connectThemeState() {
            // Listen for palette changes from ThemeState
            themeState.connect('palette-changed', (_, palette) => {
                // Only update if different to avoid loops
                if (JSON.stringify(palette) !== JSON.stringify(this._palette)) {
                    this.setPalette(palette);
                }
            });

            // Listen for color role changes
            themeState.connect('color-roles-changed', (_, colorRoles) => {
                this.loadColors(colorRoles);
            });

            // Listen for state reset
            themeState.connect('state-reset', () => {
                this.reset();
            });
        }

        _createColorRoleRow(role) {
            const row = new Adw.ActionRow({
                title: role.label,
                subtitle: role.description,
            });

            const colorButton = this._createColorButton(role);
            row.add_suffix(colorButton);

            // Store references for later updates
            row._colorButton = colorButton;
            row._roleId = role.id;

            return row;
        }

        _createColorButton(role) {
            const initialColor = new Gdk.RGBA();
            initialColor.parse('#808080');

            const colorButton = new Gtk.ColorDialogButton({
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose color',
                rgba: initialColor,
            });

            // Defer dialog creation until widget is realized to avoid GTK warnings
            colorButton.connect('realize', () => {
                if (!colorButton.dialog) {
                    colorButton.dialog = new Gtk.ColorDialog({
                        with_alpha: true,
                    });
                }
            });

            colorButton.connect('notify::rgba', () => {
                const rgba = colorButton.get_rgba();
                const hex = rgbaToHex(rgba);
                this._colorRoles.set(role.id, hex);
                // Update centralized state
                themeState.setColorRole(role.id, hex);
                this.emit('color-changed', role.id, hex);
                this._updateColorButtonStyle(colorButton, hex);
            });

            return colorButton;
        }

        _updateColorButtonStyle(button, hexColor) {
            const css = `
            .color-button-custom {
                background-color: ${hexColor};
                min-width: 48px;
                min-height: 32px;
                border-radius: 0px;
            }
        `;
            applyCssToWidget(button, css);
        }

        setPalette(colors) {
            this._palette = colors;
            this._autoAssignColors();
        }

        _autoAssignColors() {
            if (this._palette.length < 16) return;

            const assignments = this._createColorAssignments();

            forEachChild(this._listBox, childRow => {
                const roleId = childRow._roleId;
                const colorButton = childRow._colorButton;
                const assignedColor = assignments[roleId];

                if (!assignedColor) return;

                const color = new Gdk.RGBA();
                color.parse(assignedColor);
                colorButton.set_rgba(color);
                this._colorRoles.set(roleId, assignedColor);
                this._updateColorButtonStyle(colorButton, assignedColor);
            });
        }

        _createColorAssignments() {
            const semanticNames = [
                'black', 'red', 'green', 'yellow',
                'blue', 'magenta', 'cyan', 'white',
                'bright_black', 'bright_red', 'bright_green', 'bright_yellow',
                'bright_blue', 'bright_magenta', 'bright_cyan', 'bright_white',
            ];

            const assignments = {
                background: this._palette[0],
                foreground: this._palette[15],
                // Extended colors with auto-derivation from palette
                accent: this._palette[4], // blue
                cursor: this._palette[15], // foreground
                selection_foreground: this._palette[0], // background
                selection_background: this._palette[15], // foreground
            };

            semanticNames.forEach((name, i) => {
                assignments[name] = this._palette[i];
            });

            return assignments;
        }

        loadColors(colorRoles) {
            forEachChild(this._listBox, childRow => {
                const roleId = childRow._roleId;
                const colorButton = childRow._colorButton;
                const savedColor = colorRoles[roleId];

                if (!savedColor) return;

                const color = new Gdk.RGBA();
                color.parse(savedColor);
                colorButton.set_rgba(color);
                this._colorRoles.set(roleId, savedColor);
                this._updateColorButtonStyle(colorButton, savedColor);
            });
        }

        _initializeDefaults() {
            Object.entries(DEFAULT_COLORS).forEach(([roleId, color]) => {
                this._colorRoles.set(roleId, color);
            });
        }

        getColors() {
            return Object.fromEntries(this._colorRoles);
        }

        reset() {
            this._palette = [];
            this._colorRoles.clear();
            this._initializeDefaults();

            // Reset all color buttons to default colors
            forEachChild(this._listBox, childRow => {
                const roleId = childRow._roleId;
                const colorButton = childRow._colorButton;
                const defaultColor = DEFAULT_COLORS[roleId];

                if (defaultColor) {
                    const color = new Gdk.RGBA();
                    color.parse(defaultColor);
                    colorButton.set_rgba(color);
                    this._updateColorButtonStyle(colorButton, defaultColor);
                }
            });
        }

        get widget() {
            return this;
        }
    }
);
