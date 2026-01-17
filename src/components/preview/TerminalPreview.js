/**
 * TerminalPreview - Terminal mockup showing ANSI colors in context
 *
 * Displays a realistic terminal output with colored text elements
 * that update in real-time as theme colors change.
 *
 * @module TerminalPreview
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';

/**
 * Terminal line definitions with color mappings
 * Based on ghostty/kitty terminal color scheme:
 *   0=black, 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white
 *   8-15=bright variants (bright_black, bright_red, etc.)
 *
 * @type {Array<{text: string, colorRole: string}|{segments: Array<{text: string, colorRole: string}>}>}
 */
const TERMINAL_LINES = [
    {
        segments: [
            {text: '$ ', colorRole: 'green'},
            {text: 'ls -la', colorRole: 'foreground'},
        ],
    },
    {
        segments: [
            {text: 'drwxr-xr-x  ', colorRole: 'bright_black'},
            {text: 'README.md', colorRole: 'blue'},
        ],
    },
    {
        segments: [
            {text: '-rw-r--r--  ', colorRole: 'bright_black'},
            {text: 'config.js', colorRole: 'green'},
        ],
    },
    {text: '', colorRole: 'foreground'}, // Empty line
    {
        segments: [
            {text: '$ ', colorRole: 'green'},
            {text: 'git status', colorRole: 'foreground'},
        ],
    },
    {
        segments: [
            {text: 'On branch ', colorRole: 'foreground'},
            {text: 'main', colorRole: 'magenta'},
        ],
    },
    {
        segments: [
            {text: '  modified: ', colorRole: 'red'},
            {text: 'src/app.js', colorRole: 'foreground'},
        ],
    },
    {
        segments: [
            {text: '  added:    ', colorRole: 'green'},
            {text: 'src/utils.js', colorRole: 'foreground'},
        ],
    },
    {text: '', colorRole: 'foreground'}, // Empty line
    {
        segments: [
            {text: '$ ', colorRole: 'green'},
            {text: 'npm run build', colorRole: 'foreground'},
        ],
    },
    {
        segments: [
            {text: '\u2713 ', colorRole: 'green'},
            {text: 'Build successful', colorRole: 'foreground'},
        ],
    },
    {
        segments: [
            {text: '\u26a0 ', colorRole: 'yellow'},
            {text: '2 warnings', colorRole: 'yellow'},
        ],
    },
    {
        segments: [
            {text: '\u2717 ', colorRole: 'red'},
            {text: '1 error', colorRole: 'red'},
        ],
    },
];

/**
 * TerminalPreview - Terminal mockup with ANSI colors
 * @class
 * @extends {Gtk.Box}
 */
export const TerminalPreview = GObject.registerClass(
    class TerminalPreview extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._colorRoles = {};
            this._lineWidgets = [];

            this._buildUI();
        }

        _buildUI() {
            // Terminal container with background
            this._container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 2,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 8,
            });

            // Create lines
            TERMINAL_LINES.forEach(lineDef => {
                const lineBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 0,
                });

                if (lineDef.segments) {
                    // Multiple colored segments
                    lineDef.segments.forEach(segment => {
                        const label = new Gtk.Label({
                            label: segment.text,
                            xalign: 0,
                        });
                        label._colorRole = segment.colorRole;
                        lineBox.append(label);
                    });
                } else {
                    // Single line (empty or simple)
                    const label = new Gtk.Label({
                        label: lineDef.text || ' ',
                        xalign: 0,
                    });
                    label._colorRole = lineDef.colorRole;
                    lineBox.append(label);
                }

                this._lineWidgets.push(lineBox);
                this._container.append(lineBox);
            });

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

            applyCssToWidget(
                this._container,
                `box {
                background-color: ${bg};
                padding: 12px;
                border-radius: 0;
            }`
            );

            this._lineWidgets.forEach(lineBox => {
                this._forEachChild(lineBox, child => {
                    if (!child._colorRole) return;

                    const color = colorRoles[child._colorRole] || fg;
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
    }
);
