/**
 * LivePreviewPanel - Container for real-time theme previews
 *
 * Wraps Terminal and Code Editor previews in an expandable section
 * that updates live as colors change.
 *
 * @module LivePreviewPanel
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {themeState} from '../../state/ThemeState.js';
import {SignalTracker} from '../../utils/signal-tracker.js';
import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {TerminalPreview} from './TerminalPreview.js';
import {CodeEditorPreview} from './CodeEditorPreview.js';

/**
 * LivePreviewPanel - Expandable live preview container
 * @class
 * @extends {Gtk.Box}
 */
export const LivePreviewPanel = GObject.registerClass(
    class LivePreviewPanel extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            this._signals = new SignalTracker();
            this._updateTimeout = null;

            this._buildUI();
            this._connectThemeState();

            // Initial update when widget is realized
            this.connect('realize', () => {
                this._updatePreviews(themeState.getColorRoles());
            });

            // Cleanup on widget destruction
            this.connect('unrealize', () => this._cleanup());
        }

        _buildUI() {
            // Header
            const header = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const title = new Gtk.Label({
                label: 'Live Preview',
                xalign: 0,
                hexpand: true,
            });
            applyCssToWidget(
                title,
                `label {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                opacity: 0.7;
            }`
            );
            header.append(title);

            const hint = new Gtk.Label({
                label: 'Examples only, not exact app rendering',
                css_classes: ['dim-label'],
            });
            applyCssToWidget(
                hint,
                `label {
                font-size: 11px;
                opacity: 0.5;
            }`
            );
            header.append(hint);

            this.append(header);

            // Expander row for collapsible content
            const expanderGroup = new Adw.PreferencesGroup();

            // Terminal preview expander
            this._terminalExpander = new Adw.ExpanderRow({
                title: 'Terminal',
                subtitle: 'ANSI color preview',
                expanded: true,
            });
            this._terminalPreview = new TerminalPreview();
            const terminalRow = new Adw.ActionRow();
            terminalRow.set_child(this._terminalPreview);
            this._terminalExpander.add_row(terminalRow);
            expanderGroup.add(this._terminalExpander);

            // Code editor preview expander
            this._codeExpander = new Adw.ExpanderRow({
                title: 'Code Editor',
                subtitle: 'Syntax highlighting preview',
                expanded: false,
            });
            this._codePreview = new CodeEditorPreview();
            const codeRow = new Adw.ActionRow();
            codeRow.set_child(this._codePreview);
            this._codeExpander.add_row(codeRow);
            expanderGroup.add(this._codeExpander);

            this.append(expanderGroup);
        }

        _connectThemeState() {
            this._signals.track(
                themeState,
                'color-roles-changed',
                (_, colorRoles) => {
                    this._onColorsChanged(colorRoles);
                }
            );

            this._signals.track(themeState, 'palette-changed', () => {
                this._onColorsChanged(themeState.getColorRoles());
            });

            this._signals.track(themeState, 'state-reset', () => {
                this._updatePreviews(themeState.getColorRoles());
            });
        }

        /**
         * Debounced color update handler
         * @param {Object} colorRoles - New color roles
         * @private
         */
        _onColorsChanged(colorRoles) {
            // Debounce updates for performance
            if (this._updateTimeout) {
                GLib.Source.remove(this._updateTimeout);
                this._updateTimeout = null;
            }

            this._updateTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                50,
                () => {
                    this._updatePreviews(colorRoles);
                    this._updateTimeout = null;
                    return GLib.SOURCE_REMOVE;
                }
            );

            this._signals.trackTimeout(this._updateTimeout);
        }

        /**
         * Update all preview components
         * @param {Object} colorRoles - Color role mappings
         * @private
         */
        _updatePreviews(colorRoles) {
            this._terminalPreview.updateColors(colorRoles);
            this._codePreview.updateColors(colorRoles);
        }

        /**
         * Cleanup resources
         * @private
         */
        _cleanup() {
            if (this._updateTimeout) {
                GLib.Source.remove(this._updateTimeout);
                this._updateTimeout = null;
            }
            this._signals.disconnectAll();
        }
    }
);
