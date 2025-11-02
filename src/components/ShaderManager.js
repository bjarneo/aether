import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

/**
 * ShaderManager - Component for managing hyprshade screen shaders
 *
 * Provides a UI for discovering and toggling hyprshade shaders.
 * Shaders are visual effects applied to the entire screen via Hyprland.
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
                this._toggleShader(shaderId, state);
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
         */
        _toggleShader(shaderId, state) {
            try {
                let command;

                if (state) {
                    // Turn on this shader
                    command = `hyprshade on ${GLib.shell_quote(shaderId)}`;
                    this._currentShader = shaderId;
                    this._turnOffOtherShaders(shaderId);
                } else {
                    // Turn off this shader
                    command = 'hyprshade off';
                    this._currentShader = null;
                }

                GLib.spawn_command_line_async(command);

                // Emit signal
                this.emit('shader-changed', this._currentShader || 'off');
            } catch (error) {
                console.error('Error toggling shader:', error);
                this._showErrorToast(
                    `Failed to toggle shader: ${error.message}`
                );
            }
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
            const toast = new Adw.Toast({
                title: message,
                timeout: 3,
            });

            // Find the nearest ToastOverlay parent
            let parent = this.get_parent();
            while (parent && !(parent instanceof Adw.ToastOverlay)) {
                parent = parent.get_parent();
            }

            if (parent) {
                parent.add_toast(toast);
            }
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
