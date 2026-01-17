import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget} from '../utils/ui-helpers.js';
import {SPACING} from '../constants/ui-constants.js';

/**
 * ThemeActionBar - Clean action bar with grouped theme actions
 * Features primary/secondary action hierarchy
 */
export const ThemeActionBar = GObject.registerClass(
    {
        Signals: {
            'toggle-settings': {param_types: [GObject.TYPE_BOOLEAN]},
            'export-theme': {},
            'save-blueprint': {},
            'import-base16': {},
            'import-colors-toml': {},
            reset: {},
            clear: {},
            'apply-theme': {},
        },
    },
    class ThemeActionBar extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                margin_top: 0,
                margin_bottom: 0,
                hexpand: true,
            });

            applyCssToWidget(
                this,
                `
                box {
                    background-color: alpha(@headerbar_bg_color, 0.95);
                    border-top: 1px solid alpha(@borders, 0.3);
                    padding: 10px 16px;
                }
            `
            );

            this._settingsVisible = true;
            this._buildUI();
        }

        _buildUI() {
            // Left side: secondary actions
            const leftGroup = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                hexpand: true,
            });

            // Settings toggle
            this._settingsToggle = new Gtk.ToggleButton({
                icon_name: 'sidebar-show-symbolic',
                tooltip_text: 'Toggle settings panel',
                active: true,
            });
            applyCssToWidget(
                this._settingsToggle,
                `
                button {
                    border-radius: 0;
                    padding: 8px;
                }
            `
            );
            this._settingsToggle.connect('toggled', btn => {
                this._settingsVisible = btn.get_active();
                this.emit('toggle-settings', this._settingsVisible);
            });
            leftGroup.append(this._settingsToggle);

            // Separator
            const sep1 = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: 8,
                margin_end: 8,
            });
            applyCssToWidget(
                sep1,
                `
                separator {
                    opacity: 0.3;
                }
            `
            );
            leftGroup.append(sep1);

            // Export button
            const exportBtn = new Gtk.Button({
                css_classes: ['flat'],
            });
            const exportContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            exportContent.append(
                new Gtk.Image({icon_name: 'document-save-symbolic'})
            );
            exportContent.append(new Gtk.Label({label: 'Export'}));
            exportBtn.set_child(exportContent);
            applyCssToWidget(
                exportBtn,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                    font-size: 13px;
                }
            `
            );
            exportBtn.connect('clicked', () => this.emit('export-theme'));
            leftGroup.append(exportBtn);

            // Save blueprint button
            const saveBtn = new Gtk.Button({
                css_classes: ['flat'],
            });
            const saveContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            saveContent.append(
                new Gtk.Image({icon_name: 'bookmark-new-symbolic'})
            );
            saveContent.append(new Gtk.Label({label: 'Save'}));
            saveBtn.set_child(saveContent);
            applyCssToWidget(
                saveBtn,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                    font-size: 13px;
                }
            `
            );
            saveBtn.connect('clicked', () => this.emit('save-blueprint'));
            leftGroup.append(saveBtn);

            // Import menu button
            const importMenuBtn = this._createImportMenuButton();
            leftGroup.append(importMenuBtn);

            this.append(leftGroup);

            // Right side: primary actions
            const rightGroup = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
            });

            // Destructive actions (grouped, subtle)
            const destructiveGroup = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
            });

            // Clear button
            const clearBtn = new Gtk.Button({
                label: 'Clear',
                tooltip_text: 'Remove theme and switch to default',
                css_classes: ['flat'],
            });
            applyCssToWidget(
                clearBtn,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                    font-size: 13px;
                    opacity: 0.7;
                }
                button:hover {
                    opacity: 1;
                    color: @destructive_bg_color;
                }
            `
            );
            clearBtn.connect('clicked', () => this.emit('clear'));
            destructiveGroup.append(clearBtn);

            // Reset button
            const resetBtn = new Gtk.Button({
                label: 'Reset',
                tooltip_text: 'Reset all changes',
                css_classes: ['flat'],
            });
            applyCssToWidget(
                resetBtn,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                    font-size: 13px;
                    opacity: 0.7;
                }
                button:hover {
                    opacity: 1;
                    color: @destructive_bg_color;
                }
            `
            );
            resetBtn.connect('clicked', () => this.emit('reset'));
            destructiveGroup.append(resetBtn);

            rightGroup.append(destructiveGroup);

            // Separator
            const sep2 = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: 8,
                margin_end: 8,
            });
            applyCssToWidget(
                sep2,
                `
                separator {
                    opacity: 0.3;
                }
            `
            );
            rightGroup.append(sep2);

            // Apply button (primary CTA)
            const applyBtn = new Gtk.Button({
                css_classes: ['suggested-action'],
            });
            const applyContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
            });
            applyContent.append(
                new Gtk.Image({icon_name: 'emblem-ok-symbolic'})
            );
            applyContent.append(new Gtk.Label({label: 'Apply Theme'}));
            applyBtn.set_child(applyContent);
            applyCssToWidget(
                applyBtn,
                `
                button {
                    border-radius: 0;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                }
            `
            );
            applyBtn.connect('clicked', () => this.emit('apply-theme'));
            rightGroup.append(applyBtn);

            this.append(rightGroup);
        }

        setSettingsVisible(visible) {
            this._settingsToggle.set_active(visible);
        }

        /**
         * Creates the import menu button with dropdown
         * @returns {Gtk.MenuButton} The menu button widget
         * @private
         */
        _createImportMenuButton() {
            // Create popover with import options
            const popover = new Gtk.Popover();

            const popoverBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.SM,
                margin_end: SPACING.SM,
            });

            // Base16 import option
            const base16ButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });
            base16ButtonBox.append(
                new Gtk.Image({icon_name: 'document-open-symbolic'})
            );
            base16ButtonBox.append(new Gtk.Label({label: 'Base16 (.yaml)'}));

            const base16Button = new Gtk.Button({
                child: base16ButtonBox,
                css_classes: ['flat'],
            });
            base16Button.connect('clicked', () => {
                popover.popdown();
                this.emit('import-base16');
            });
            popoverBox.append(base16Button);

            // Colors.toml import option
            const tomlButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });
            tomlButtonBox.append(
                new Gtk.Image({icon_name: 'document-open-symbolic'})
            );
            tomlButtonBox.append(new Gtk.Label({label: 'Colors (.toml)'}));

            const tomlButton = new Gtk.Button({
                child: tomlButtonBox,
                css_classes: ['flat'],
            });
            tomlButton.connect('clicked', () => {
                popover.popdown();
                this.emit('import-colors-toml');
            });
            popoverBox.append(tomlButton);

            popover.set_child(popoverBox);

            // Create menu button with label
            const buttonContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            buttonContent.append(
                new Gtk.Image({icon_name: 'document-open-symbolic'})
            );
            buttonContent.append(new Gtk.Label({label: 'Import'}));

            const menuButton = new Gtk.MenuButton({
                child: buttonContent,
                popover: popover,
                tooltip_text: 'Import color scheme',
                css_classes: ['flat'],
            });
            applyCssToWidget(
                menuButton,
                `
                menubutton button {
                    border-radius: 0;
                    padding: 6px 12px;
                    font-size: 13px;
                }
            `
            );

            return menuButton;
        }

        get widget() {
            return this;
        }
    }
);
