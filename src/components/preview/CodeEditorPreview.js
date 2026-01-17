/**
 * CodeEditorPreview - Code editor mockup with syntax highlighting
 *
 * Displays a code snippet with syntax-aware coloring that updates
 * in real-time as theme colors change.
 *
 * @module CodeEditorPreview
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';

/**
 * Token type to color role mappings
 * Based on neovim.lua template color scheme
 * @type {Object<string, string>}
 */
const TOKEN_COLORS = {
    // comment: Line highlight, gutter elements, disabled states
    comment: 'color8', // bright_black
    // keyword: function, const, import, from, return, etc.
    keyword: 'color4', // blue
    // string: String literals
    string: 'color2', // green
    // number: Numeric literals
    number: 'color3', // yellow
    // boolean: true, false, null, undefined
    boolean: 'color3', // yellow
    // function: Function names and calls
    function: 'color4', // blue
    // type: Type annotations, classes
    type: 'color3', // yellow
    // variable: Default text, identifiers
    variable: 'foreground',
    // property: Object properties, parameters
    property: 'color6', // cyan
    // operator: =, +, -, etc.
    operator: 'color5', // magenta
    // punctuation: Braces, semicolons, etc.
    punctuation: 'foreground',
    // lineNumber: Gutter line numbers
    lineNumber: 'color8', // bright_black
};

/**
 * Code lines with token definitions
 * Line numbers are auto-generated
 * @type {Array<Array<{text: string, type: string}>>}
 */
const CODE_LINES = [
    [{text: '// Theme configuration', type: 'comment'}],
    [
        {text: 'import', type: 'keyword'},
        {text: ' ', type: 'variable'},
        {text: '{', type: 'punctuation'},
        {text: ' applyTheme ', type: 'function'},
        {text: '}', type: 'punctuation'},
        {text: ' ', type: 'variable'},
        {text: 'from', type: 'keyword'},
        {text: ' ', type: 'variable'},
        {text: "'./theme'", type: 'string'},
        {text: ';', type: 'punctuation'},
    ],
    [],
    [
        {text: 'const', type: 'keyword'},
        {text: ' config ', type: 'variable'},
        {text: '=', type: 'operator'},
        {text: ' ', type: 'variable'},
        {text: '{', type: 'punctuation'},
    ],
    [
        {text: '    ', type: 'variable'},
        {text: 'name', type: 'property'},
        {text: ':', type: 'punctuation'},
        {text: ' ', type: 'variable'},
        {text: '"Aether"', type: 'string'},
        {text: ',', type: 'punctuation'},
    ],
    [
        {text: '    ', type: 'variable'},
        {text: 'colors', type: 'property'},
        {text: ':', type: 'punctuation'},
        {text: ' ', type: 'variable'},
        {text: '16', type: 'number'},
        {text: ',', type: 'punctuation'},
    ],
    [
        {text: '    ', type: 'variable'},
        {text: 'darkMode', type: 'property'},
        {text: ':', type: 'punctuation'},
        {text: ' ', type: 'variable'},
        {text: 'true', type: 'boolean'},
        {text: ',', type: 'punctuation'},
    ],
    [{text: '};', type: 'punctuation'}],
    [],
    [
        {text: 'function', type: 'keyword'},
        {text: ' ', type: 'variable'},
        {text: 'init', type: 'function'},
        {text: '(', type: 'punctuation'},
        {text: 'options', type: 'property'},
        {text: ')', type: 'punctuation'},
        {text: ' ', type: 'variable'},
        {text: '{', type: 'punctuation'},
    ],
    [
        {text: '    ', type: 'variable'},
        {text: 'applyTheme', type: 'function'},
        {text: '(', type: 'punctuation'},
        {text: 'config', type: 'variable'},
        {text: ')', type: 'punctuation'},
        {text: ';', type: 'punctuation'},
    ],
    [{text: '}', type: 'punctuation'}],
];

/**
 * CodeEditorPreview - Code editor with syntax highlighting
 * @class
 * @extends {Gtk.Box}
 */
export const CodeEditorPreview = GObject.registerClass(
    class CodeEditorPreview extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._colorRoles = {};
            this._lineWidgets = [];
            this._lineNumberLabels = [];

            this._buildUI();
        }

        _buildUI() {
            // Main container
            this._container = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
            });

            // Line numbers gutter
            this._gutter = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            // Code content
            this._codeBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                hexpand: true,
            });

            // Create lines
            CODE_LINES.forEach((tokens, index) => {
                // Line number
                const lineNum = new Gtk.Label({
                    label: String(index + 1).padStart(2, ' '),
                    xalign: 1,
                    width_chars: 3,
                });
                this._lineNumberLabels.push(lineNum);
                this._gutter.append(lineNum);

                // Code line
                const lineBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 0,
                });

                if (tokens.length === 0) {
                    // Empty line
                    const spacer = new Gtk.Label({label: ' '});
                    lineBox.append(spacer);
                } else {
                    tokens.forEach(token => {
                        const label = new Gtk.Label({
                            label: token.text,
                            xalign: 0,
                        });
                        label._tokenType = token.type;
                        lineBox.append(label);
                    });
                }

                this._lineWidgets.push(lineBox);
                this._codeBox.append(lineBox);
            });

            this._container.append(this._gutter);
            this._container.append(this._codeBox);
            this.append(this._container);
        }

        /**
         * Update colors from theme state
         * @param {Object} colorRoles - Color role mappings
         */
        updateColors(colorRoles) {
            this._colorRoles = colorRoles;

            const bg = colorRoles.background || '#1e1e2e';
            const fg = colorRoles.foreground || '#ffffff';
            const gutterBg = this._darkenColor(bg, 0.15);
            const lineNumColor =
                colorRoles[TOKEN_COLORS.lineNumber] ||
                colorRoles.color8 ||
                '#666666';

            applyCssToWidget(
                this._container,
                `box {
                background-color: ${bg};
                border-radius: 0;
            }`
            );

            applyCssToWidget(
                this._gutter,
                `box {
                background-color: ${gutterBg};
                padding: 8px 4px 8px 8px;
            }`
            );

            applyCssToWidget(
                this._codeBox,
                `box {
                padding: 8px 12px;
            }`
            );

            this._lineNumberLabels.forEach(label => {
                applyCssToWidget(
                    label,
                    `label {
                    color: ${lineNumColor};
                    font-family: monospace;
                    font-size: 11px;
                    opacity: 0.6;
                }`
                );
            });

            this._lineWidgets.forEach(lineBox => {
                this._forEachChild(lineBox, child => {
                    const colorRole =
                        TOKEN_COLORS[child._tokenType] || 'foreground';
                    const color = colorRoles[colorRole] || fg;

                    applyCssToWidget(
                        child,
                        `label {
                        color: ${color};
                        font-family: monospace;
                        font-size: 11px;
                    }`
                    );
                });
            });
        }

        /**
         * Iterate over widget children
         * @param {Gtk.Widget} parent - Parent widget
         * @param {Function} callback - Callback for each child
         * @private
         */
        _forEachChild(parent, callback) {
            let child = parent.get_first_child();
            while (child) {
                callback(child);
                child = child.get_next_sibling();
            }
        }

        /**
         * Darken a hex color by a percentage
         * @param {string} hex - Hex color
         * @param {number} percent - Darken percentage (0-1)
         * @returns {string} Darkened hex color
         * @private
         */
        _darkenColor(hex, percent) {
            const num = parseInt(hex.replace('#', ''), 16);
            const multiplier = 1 - percent;

            const r = Math.max(
                0,
                Math.round(((num >> 16) & 0xff) * multiplier)
            );
            const g = Math.max(0, Math.round(((num >> 8) & 0xff) * multiplier));
            const b = Math.max(0, Math.round((num & 0xff) * multiplier));

            const toHex = n => n.toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
    }
);
