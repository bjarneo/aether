import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget} from '../utils/ui-helpers.js';
import {SPACING} from '../constants/ui-constants.js';

/** @constant {string} Shared CSS for flat action buttons */
const FLAT_BUTTON_CSS = `
    button {
        border-radius: 0;
        padding: 6px 12px;
        font-size: 13px;
    }
`;

/** @constant {string} CSS for separator elements */
const SEPARATOR_CSS = `
    separator {
        opacity: 0.3;
    }
`;

/** @constant {string} CSS for destructive buttons with hover effect */
const DESTRUCTIVE_BUTTON_CSS = `
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
`;

/**
 * Create a button with icon and label
 * @param {string} iconName - Icon name
 * @param {string} label - Button label
 * @param {string[]} cssClasses - CSS classes for button
 * @returns {Gtk.Button} The created button
 */
function createIconLabelButton(iconName, label, cssClasses = ['flat']) {
    const content = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
    });
    content.append(new Gtk.Image({icon_name: iconName}));
    content.append(new Gtk.Label({label}));

    const button = new Gtk.Button({
        child: content,
        css_classes: cssClasses,
    });
    applyCssToWidget(button, FLAT_BUTTON_CSS);

    return button;
}

/**
 * Create a styled separator
 * @returns {Gtk.Separator} The created separator
 */
function createSeparator(marginStart = 8, marginEnd = 8) {
    const separator = new Gtk.Separator({
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: marginStart,
        margin_end: marginEnd,
    });
    applyCssToWidget(separator, SEPARATOR_CSS);
    return separator;
}

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
            undo: {},
            redo: {},
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

            leftGroup.append(createSeparator());

            // Export button
            const exportBtn = createIconLabelButton(
                'document-save-symbolic',
                'Export'
            );
            exportBtn.connect('clicked', () => this.emit('export-theme'));
            leftGroup.append(exportBtn);

            // Save blueprint button
            const saveBtn = createIconLabelButton(
                'bookmark-new-symbolic',
                'Save'
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

            // Undo/Redo buttons
            const historyGroup = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
            });

            const historyButtonCss = `
                button {
                    border-radius: 0;
                    padding: 6px 10px;
                }
            `;

            this._undoBtn = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                tooltip_text: 'Undo (Ctrl+Z)',
                css_classes: ['flat'],
                sensitive: false,
            });
            applyCssToWidget(this._undoBtn, historyButtonCss);
            this._undoBtn.connect('clicked', () => this.emit('undo'));
            historyGroup.append(this._undoBtn);

            this._redoBtn = new Gtk.Button({
                icon_name: 'edit-redo-symbolic',
                tooltip_text: 'Redo (Ctrl+Shift+Z)',
                css_classes: ['flat'],
                sensitive: false,
            });
            applyCssToWidget(this._redoBtn, historyButtonCss);
            this._redoBtn.connect('clicked', () => this.emit('redo'));
            historyGroup.append(this._redoBtn);

            rightGroup.append(historyGroup);
            rightGroup.append(createSeparator(4, 4));

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
            applyCssToWidget(clearBtn, DESTRUCTIVE_BUTTON_CSS);
            clearBtn.connect('clicked', () => this.emit('clear'));
            destructiveGroup.append(clearBtn);

            // Reset button
            const resetBtn = new Gtk.Button({
                label: 'Reset',
                tooltip_text: 'Reset all changes',
                css_classes: ['flat'],
            });
            applyCssToWidget(resetBtn, DESTRUCTIVE_BUTTON_CSS);
            resetBtn.connect('clicked', () => this.emit('reset'));
            destructiveGroup.append(resetBtn);

            rightGroup.append(destructiveGroup);
            rightGroup.append(createSeparator());

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
            const popover = new Gtk.Popover();

            const popoverBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.SM,
                margin_end: SPACING.SM,
            });

            // Import options configuration
            const importOptions = [
                {label: 'Base16 (.yaml)', signal: 'import-base16'},
                {label: 'Colors (.toml)', signal: 'import-colors-toml'},
            ];

            for (const option of importOptions) {
                const buttonBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: SPACING.SM,
                });
                buttonBox.append(
                    new Gtk.Image({icon_name: 'document-open-symbolic'})
                );
                buttonBox.append(new Gtk.Label({label: option.label}));

                const button = new Gtk.Button({
                    child: buttonBox,
                    css_classes: ['flat'],
                });
                button.connect('clicked', () => {
                    popover.popdown();
                    this.emit(option.signal);
                });
                popoverBox.append(button);
            }

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
                popover,
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

        /**
         * Set undo button enabled state
         * @param {boolean} enabled - Whether undo is available
         */
        setUndoEnabled(enabled) {
            this._undoBtn.set_sensitive(enabled);
        }

        /**
         * Set redo button enabled state
         * @param {boolean} enabled - Whether redo is available
         */
        setRedoEnabled(enabled) {
            this._redoBtn.set_sensitive(enabled);
        }
    }
);
