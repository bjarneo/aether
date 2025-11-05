import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {showToast} from '../utils/ui-helpers.js';
import {FilterConfirmationDialog} from './wallpaper-editor/FilterConfirmationDialog.js';

/**
 * ShaderManager - Component for managing hyprshade screen shaders
 *
 * Provides a UI for discovering, browsing, and toggling hyprshade shaders
 * within the Aether theme application. Shaders are visual effects (blue light
 * filters, color grading, CRT effects, etc.) applied to the entire screen
 * via Hyprland's compositor using hyprshade.
 *
 * Features:
 * - Auto-discovers shaders from hyprshade (`hyprshade ls`)
 * - Toggle switches for each shader (only one active at a time)
 * - Displays current active shader on load
 * - Scrollable list with up to 600px height
 * - Formatted shader names (e.g., "blue-light-filter" → "Blue Light Filter")
 * - Refresh capability to reload shader list
 * - Empty state with installation instructions
 *
 * hyprshade Integration:
 * - Uses `hyprshade ls` to list available shaders
 * - Uses `hyprshade current` to get active shader
 * - Uses `hyprshade on <shader>` to enable a shader
 * - Uses `hyprshade off` to disable shaders
 * - Shaders are installed to ~/.config/hypr/shaders/
 *
 * UI Structure:
 * - Adw.ExpanderRow container (collapsible)
 * - Gtk.ScrolledWindow with Gtk.ListBox (boxed-list style)
 * - Adw.ActionRow for each shader with Gtk.Switch suffix
 * - Error handling with inline error rows
 *
 * Signals:
 * - 'shader-changed': (shaderName: string) - Emitted when shader is toggled
 *   - shaderName is the shader filename or 'off' if disabled
 *
 * Public Methods:
 * - refresh() - Reload shader list from hyprshade
 * - getCurrentShader() - Get currently active shader name (or null)
 *
 * @example
 * const shaderManager = new ShaderManager();
 * shaderManager.connect('shader-changed', (widget, shaderName) => {
 *     console.log(`Shader changed to: ${shaderName}`);
 * });
 * shaderManager.refresh(); // Reload shaders
 */
export const ShaderManager = GObject.registerClass(
    {
        Signals: {
            'shader-changed': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class ShaderManager extends Adw.ExpanderRow {
        _init() {
            super._init({
                title: 'Shaders',
                subtitle: 'Apply visual effects with hyprshade',
                expanded: false,
            });

            this._shaders = [];
            this._currentShader = null;
            this._shaderRows = new Map();

            this._setupScrollableContent();
            this._loadShaders();
        }

        /**
         * Setup scrollable container for shader list
         * @private
         */
        _setupScrollableContent() {
            this._listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE,
                css_classes: ['boxed-list'],
            });

            this._scrolledWindow = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                min_content_height: 300,
                max_content_height: 600,
                child: this._listBox,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            contentBox.append(this._scrolledWindow);
            this.add_row(contentBox);
        }

        /**
         * Load available shaders from hyprshade
         * @private
         */
        _loadShaders() {
            try {
                // Get list of available shaders
                const [success, stdout, stderr] =
                    GLib.spawn_command_line_sync('hyprshade ls');

                if (!success) {
                    console.error(
                        'Failed to list shaders:',
                        new TextDecoder().decode(stderr)
                    );
                    this._showError('hyprshade not found');
                    return;
                }

                const output = new TextDecoder().decode(stdout);
                this._shaders = output
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                // Get current shader
                this._updateCurrentShader();

                // Build UI
                this._buildShaderList();
            } catch (error) {
                console.error('Error loading shaders:', error);
                this._showError('Failed to load shaders');
            }
        }

        /**
         * Update current shader state from hyprshade
         * @private
         */
        _updateCurrentShader() {
            try {
                const [success, stdout] =
                    GLib.spawn_command_line_sync('hyprshade current');

                if (success) {
                    const output = new TextDecoder().decode(stdout).trim();
                    this._currentShader = output || null;
                } else {
                    this._currentShader = null;
                }
            } catch (error) {
                console.error('Error getting current shader:', error);
                this._currentShader = null;
            }
        }

        /**
         * Build the shader list UI
         * @private
         */
        _buildShaderList() {
            if (this._shaders.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: 'No shaders found',
                    subtitle: 'Install shaders to ~/.config/hypr/shaders',
                });
                this._listBox.append(emptyRow);
                return;
            }

            // Add all available shaders (no "Off" button needed with switches)
            this._shaders.forEach(shader => {
                const row = this._createShaderRow(
                    shader,
                    this._formatShaderName(shader),
                    shader
                );
                this._listBox.append(row);
            });
        }

        /**
         * Create a shader row with toggle switch
         * @private
         * @param {string} shaderId - Shader identifier
         * @param {string} title - Display title
         * @param {string} subtitle - Display subtitle
         * @returns {Adw.ActionRow}
         */
        _createShaderRow(shaderId, title, subtitle) {
            const row = new Adw.ActionRow({
                title,
                subtitle,
            });

            const toggleSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
            });

            // Set initial state
            const isActive = shaderId === this._currentShader;
            toggleSwitch.set_active(isActive);

            // Connect to state-set signal to handle toggle
            toggleSwitch.connect('state-set', (sw, state) => {
                this._toggleShader(shaderId, state, toggleSwitch);
                return false; // Allow state change to proceed
            });

            row.add_suffix(toggleSwitch);
            row.set_activatable_widget(toggleSwitch);

            // Store reference for later updates
            this._shaderRows.set(shaderId, {row, toggleSwitch});

            return row;
        }

        /**
         * Toggle a shader on/off
         * @private
         * @param {string} shaderId - Shader to toggle
         * @param {boolean} state - New state (true = on, false = off)
         * @param {Gtk.Switch} toggleSwitch - The switch widget that was toggled
         */
        _toggleShader(shaderId, state, toggleSwitch) {
            if (state) {
                // Turning shader ON - apply immediately and show confirmation
                this._toggleShaderOnWithConfirmation(shaderId, toggleSwitch);
            } else {
                // Turning shader OFF - no confirmation needed
                this._toggleShaderOff();
            }
        }

        /**
         * Turn on a shader with confirmation dialog
         * @private
         * @param {string} shaderId - Shader to enable
         * @param {Gtk.Switch} toggleSwitch - The switch widget that was toggled
         */
        async _toggleShaderOnWithConfirmation(shaderId, toggleSwitch) {
            try {
                // Apply the shader immediately (so user can see the effect)
                const command = `hyprshade on ${GLib.shell_quote(shaderId)}`;
                GLib.spawn_command_line_async(command);

                const previousShader = this._currentShader;
                this._currentShader = shaderId;
                this._turnOffOtherShaders(shaderId);

                // Show confirmation dialog with 60 second countdown
                const response = await this._showConfirmationDialog();

                if (response === 'keep') {
                    // User confirmed - keep the shader on
                    console.log(`User confirmed shader: ${shaderId}`);
                    this.emit('shader-changed', shaderId);
                } else {
                    // User reverted or timeout - turn shader back off
                    console.log(`Reverting shader: ${shaderId}`);
                    GLib.spawn_command_line_async('hyprshade off');
                    this._currentShader = null;

                    // Update switch to OFF state
                    this._updateSwitchState(toggleSwitch, false);

                    // If there was a previous shader, restore its switch state
                    if (previousShader && previousShader !== shaderId) {
                        const previousData = this._shaderRows.get(previousShader);
                        if (previousData) {
                            this._updateSwitchState(previousData.toggleSwitch, true);
                            this._currentShader = previousShader;
                        }
                    }

                    this.emit('shader-changed', 'off');
                }
            } catch (error) {
                console.error('Error toggling shader:', error);
                this._showErrorToast(
                    `Failed to toggle shader: ${error.message}`
                );
                // Revert switch state on error
                this._updateSwitchState(toggleSwitch, false);
            }
        }

        /**
         * Turn off the current shader
         * @private
         */
        _toggleShaderOff() {
            try {
                GLib.spawn_command_line_async('hyprshade off');
                this._currentShader = null;
                this.emit('shader-changed', 'off');
            } catch (error) {
                console.error('Error turning off shader:', error);
                this._showErrorToast(
                    `Failed to turn off shader: ${error.message}`
                );
            }
        }

        /**
         * Update switch state without triggering signal
         * @private
         * @param {Gtk.Switch} toggleSwitch - Switch to update
         * @param {boolean} state - New state
         */
        _updateSwitchState(toggleSwitch, state) {
            GObject.signal_handlers_block_matched(
                toggleSwitch,
                GObject.SignalMatchType.DATA,
                0,
                0,
                null,
                null,
                null
            );
            toggleSwitch.set_active(state);
            GObject.signal_handlers_unblock_matched(
                toggleSwitch,
                GObject.SignalMatchType.DATA,
                0,
                0,
                null,
                null,
                null
            );
        }

        /**
         * Shows the shader confirmation dialog with countdown
         * @private
         * @returns {Promise<string>} User's choice: 'keep' or 'revert'
         */
        async _showConfirmationDialog() {
            const parentWindow = this.get_root();
            const dialog = new FilterConfirmationDialog(parentWindow, 60);
            return await dialog.show();
        }

        /**
         * Turn off all other shader switches
         * @private
         * @param {string} exceptShaderId - Shader to keep active
         */
        _turnOffOtherShaders(exceptShaderId) {
            this._shaderRows.forEach((data, shaderId) => {
                if (shaderId !== exceptShaderId) {
                    const {toggleSwitch} = data;
                    // Block handler to prevent recursive calls
                    GObject.signal_handlers_block_matched(
                        toggleSwitch,
                        GObject.SignalMatchType.DATA,
                        0,
                        0,
                        null,
                        null,
                        null
                    );
                    toggleSwitch.set_active(false);
                    GObject.signal_handlers_unblock_matched(
                        toggleSwitch,
                        GObject.SignalMatchType.DATA,
                        0,
                        0,
                        null,
                        null,
                        null
                    );
                }
            });
        }

        /**
         * Format shader name for display
         * @private
         * @param {string} shader - Shader filename
         * @returns {string} Formatted name
         */
        _formatShaderName(shader) {
            return shader
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        /**
         * Show error message in the UI
         * @private
         * @param {string} message - Error message
         */
        _showError(message) {
            const errorRow = new Adw.ActionRow({
                title: 'Error',
                subtitle: message,
            });
            this._listBox.append(errorRow);
        }

        /**
         * Show error toast notification
         * @private
         * @param {string} message - Error message
         */
        _showErrorToast(message) {
            showToast(this, message, 3);
        }

        /**
         * Refresh shader list and current state
         * @public
         */
        refresh() {
            // Clear existing rows from list box
            let child = this._listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._listBox.remove(child);
                child = next;
            }

            this._shaderRows.clear();
            this._loadShaders();
        }

        /**
         * Get current active shader
         * @public
         * @returns {string|null} Current shader name or null
         */
        getCurrentShader() {
            return this._currentShader;
        }
    }
);
