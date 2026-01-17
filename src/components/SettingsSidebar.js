import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {ColorAdjustmentControls} from './palette/color-adjustment-controls.js';
import {AccessibilityPanel} from './AccessibilityPanel.js';
import {FontSelector} from './FontSelector.js';
import {COLOR_PRESETS} from '../constants/presets.js';
import {NEOVIM_PRESETS} from '../constants/neovim-presets.js';
import {SPACING, SIDEBAR} from '../constants/ui-constants.js';
import {
    applyCssToWidget,
    removeAllChildren,
    showToast,
} from '../utils/ui-helpers.js';
import {
    createSwitchRow,
    createExpanderRow,
    createColorPickerRow,
    createWrapperRow,
} from '../utils/ui-builders.js';
import {
    rgbaToHex,
    generatePaletteFromColor,
    generateGradient,
} from '../utils/color-utils.js';
import {
    loadJsonFile,
    saveJsonFile,
    ensureDirectoryExists,
} from '../utils/file-utils.js';
import {themeState} from '../state/ThemeState.js';

/**
 * SettingsSidebar - Comprehensive theme settings and customization panel
 *
 * Features:
 * - Light/dark mode toggle for color extraction
 * - Color adjustments (vibrance, contrast, brightness, hue, temperature, gamma)
 * - Gradient generator with preview
 * - Palette generation from single color
 * - Preset library (10 popular themes: Dracula, Nord, Gruvbox, etc.)
 * - Neovim theme selector (37 LazyVim-compatible themes)
 * - Template settings (enable/disable optional templates)
 * - Accessibility checker integration
 *
 * Signals:
 * - 'adjustments-changed' (adjustments: object) - Color adjustments modified
 * - 'adjustments-reset' - Reset adjustments to defaults
 * - 'settings-changed' (settings: object) - Template settings changed
 * - 'preset-applied' (preset: object) - Color preset applied
 * - 'gradient-generated' (gradient: object) - Gradient colors generated
 * - 'light-mode-changed' (enabled: boolean) - Light mode toggled
 * - 'palette-from-color-generated' (palette: object) - Palette generated from single color
 * - 'neovim-theme-changed' (enabled: boolean) - Neovim theme inclusion changed
 *
 * Configuration:
 * - Settings persisted to ~/.config/aether/settings.json
 * - Includes template enable/disable flags
 * - Stores Neovim theme preferences
 *
 * @class SettingsSidebar
 * @extends {Gtk.Box}
 */
export const SettingsSidebar = GObject.registerClass(
    {
        Signals: {
            'adjustments-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'adjustments-reset': {},
            'settings-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'preset-applied': {param_types: [GObject.TYPE_JSOBJECT]},
            'gradient-generated': {param_types: [GObject.TYPE_JSOBJECT]},
            'light-mode-changed': {param_types: [GObject.TYPE_BOOLEAN]},
            'palette-from-color-generated': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'neovim-theme-changed': {param_types: [GObject.TYPE_BOOLEAN]},
        },
    },
    class SettingsSidebar extends Gtk.Box {
        /**
         * Initializes the SettingsSidebar with default values and UI
         * Loads persisted settings from disk
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._settingsPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'settings.json',
            ]);

            // Default values
            this._includeNeovim = true;
            this._includeZed = false;
            this._includeVscode = false;
            this._includeGtk = false;
            this._lightMode = false;
            this._selectedNeovimConfig = null;
            this._neovimPresetRows = []; // Store references to preset rows for visual feedback
            this._baseColor = '#89b4fa'; // Default base color for palette generation

            // Load persisted settings
            this._loadSettings();

            this._initializeUI();
            this._connectThemeState();
        }

        /**
         * Connect to centralized theme state signals
         * @private
         */
        _connectThemeState() {
            // Listen for light mode changes from other components
            themeState.connect('light-mode-changed', (_, lightMode) => {
                if (this._lightMode !== lightMode) {
                    this._lightMode = lightMode;
                    // Update UI switch if exists
                    if (this._lightModeSwitch) {
                        this._lightModeSwitch.set_active(lightMode);
                    }
                }
            });

            // Listen for adjustments changes
            themeState.connect('adjustments-changed', (_, adjustments) => {
                if (this._adjustmentControls) {
                    this._adjustmentControls.setValues(adjustments);
                }
            });

            // Listen for neovim theme changes
            themeState.connect('neovim-theme-changed', (_, theme) => {
                if (theme && theme !== this._selectedNeovimConfig) {
                    this._selectedNeovimConfig = theme;
                    this._updateNeovimPresetSelection(theme);
                }
            });

            // Listen for state reset
            themeState.connect('state-reset', () => {
                this.resetAdjustments();
                this._lightMode = false;
                if (this._lightModeSwitch) {
                    this._lightModeSwitch.set_active(false);
                }
                this._selectedNeovimConfig = null;
                this._updateNeovimPresetSelection(null);
            });
        }

        /**
         * Initializes all UI sections and adds them to scrollable container
         * Creates light mode, adjustments, gradient, presets, Neovim, font, template, and accessibility sections
         * @private
         */
        _initializeUI() {
            // Settings header
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.SM,
            });

            const headerLabel = new Gtk.Label({
                label: 'SETTINGS',
                xalign: 0,
            });
            applyCssToWidget(
                headerLabel,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    opacity: 0.7;
                }
            `
            );
            headerBox.append(headerLabel);

            const headerSubtitle = new Gtk.Label({
                label: 'Customize your theme',
                xalign: 0,
            });
            applyCssToWidget(
                headerSubtitle,
                `
                label {
                    font-size: 11px;
                    opacity: 0.5;
                }
            `
            );
            headerBox.append(headerSubtitle);
            this.append(headerBox);

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            // Light Mode Section
            const lightModeGroup = this._createLightModeSection();
            contentBox.append(lightModeGroup);

            // Color Adjustments Section (Collapsible)
            const adjustmentsExpander = this._createAdjustmentsSection();
            contentBox.append(adjustmentsExpander);

            // Gradient Generator Section
            const gradientSection = this._createGradientSection();
            contentBox.append(gradientSection);

            // Palette from Single Color Section
            const paletteFromColorSection =
                this._createPaletteFromColorSection();
            contentBox.append(paletteFromColorSection);

            // Presets Section
            const presetsSection = this._createPresetsSection();
            contentBox.append(presetsSection);

            // Neovim Themes Section
            const neovimSection = this._createNeovimPresetsSection();
            contentBox.append(neovimSection);

            // Font Selector Section
            const fontSection = this._createFontSection();
            contentBox.append(fontSection);

            // Template Settings Section
            const templateSettings = this._createTemplateSettings();
            contentBox.append(templateSettings);

            // Accessibility Section (at bottom)
            this._accessibilityPanel = new AccessibilityPanel();
            contentBox.append(this._accessibilityPanel);

            scrolled.set_child(contentBox);
            this.append(scrolled);
        }

        /**
         * Creates light mode toggle section
         * Emits 'light-mode-changed' signal when toggled
         * @returns {Adw.PreferencesGroup} Light mode section widget
         * @private
         */
        _createLightModeSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Theme Mode',
            });

            const {row, switch: lightModeSwitch} = createSwitchRow({
                title: 'Light Mode',
                subtitle: 'Generate light color scheme',
                active: this._lightMode,
                onChanged: active => {
                    this._lightMode = active;
                    themeState.setLightMode(active);
                    this.emit('light-mode-changed', this._lightMode);
                },
            });

            this._lightModeSwitch = lightModeSwitch;
            group.add(row);

            return group;
        }

        /**
         * Creates collapsible color adjustments section
         * Includes vibrance, contrast, brightness, hue shift, temperature, and gamma controls
         * @returns {Adw.ExpanderRow} Adjustments expander widget
         * @private
         */
        _createAdjustmentsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Color Adjustments',
                subtitle: 'Fine-tune your palette',
                expanded: true, // Open by default
            });

            this._adjustmentControls = new ColorAdjustmentControls(
                values => {
                    themeState.setAdjustments(values);
                    this.emit('adjustments-changed', values);
                },
                () => {
                    themeState.resetAdjustments();
                    this.emit('adjustments-reset');
                }
            );

            expanderRow.add_row(
                createWrapperRow({
                    child: this._adjustmentControls.widget,
                })
            );

            return expanderRow;
        }

        /**
         * Creates gradient generator section with color pickers and preview
         * Generates smooth color transitions between two colors
         * @returns {Adw.PreferencesGroup} Gradient generator widget
         * @private
         */
        _createGradientSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Gradient Generator',
                subtitle: 'Create smooth color gradients',
            });

            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
            });

            // Start color selection
            const startColorRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                halign: Gtk.Align.FILL,
            });

            const startColorLabel = new Gtk.Label({
                label: 'Start Color',
                xalign: 0,
                hexpand: true,
            });

            const startColor = new Gdk.RGBA();
            startColor.parse('#1e1e2e');

            this._gradientStartButton = new Gtk.ColorDialogButton({
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose start color',
                rgba: startColor,
            });

            // Defer dialog creation until widget is realized to avoid GTK warnings
            this._gradientStartButton.connect('realize', btn => {
                if (!btn.dialog) {
                    btn.dialog = new Gtk.ColorDialog({with_alpha: false});
                }
            });

            startColorRow.append(startColorLabel);
            startColorRow.append(this._gradientStartButton);
            controlsBox.append(startColorRow);

            // End color selection
            const endColorRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                halign: Gtk.Align.FILL,
            });

            const endColorLabel = new Gtk.Label({
                label: 'End Color',
                xalign: 0,
                hexpand: true,
            });

            const endColor = new Gdk.RGBA();
            endColor.parse('#cdd6f4');

            this._gradientEndButton = new Gtk.ColorDialogButton({
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose end color',
                rgba: endColor,
            });

            // Defer dialog creation until widget is realized to avoid GTK warnings
            this._gradientEndButton.connect('realize', btn => {
                if (!btn.dialog) {
                    btn.dialog = new Gtk.ColorDialog({with_alpha: false});
                }
            });

            endColorRow.append(endColorLabel);
            endColorRow.append(this._gradientEndButton);
            controlsBox.append(endColorRow);

            // Gradient preview
            this._gradientPreviewBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                margin_top: SPACING.MD,
                height_request: 40,
            });
            applyCssToWidget(
                this._gradientPreviewBox,
                `
                box {
                    border: 1px solid alpha(@borders, 0.2);
                    border-radius: 0;
                }
            `
            );
            controlsBox.append(this._gradientPreviewBox);

            // Generate button
            const generateButton = new Gtk.Button({
                label: 'Generate Palette',
                halign: Gtk.Align.CENTER,
                margin_top: SPACING.SM,
                css_classes: ['suggested-action'],
            });
            applyCssToWidget(
                generateButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 16px;
                }
            `
            );
            generateButton.connect('clicked', () => this._generateGradient());

            controlsBox.append(generateButton);

            // Update preview when colors change
            this._gradientStartButton.connect('notify::rgba', () =>
                this._updateGradientPreview()
            );
            this._gradientEndButton.connect('notify::rgba', () =>
                this._updateGradientPreview()
            );

            // Initialize preview
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._updateGradientPreview();
                return GLib.SOURCE_REMOVE;
            });

            expanderRow.add_row(
                createWrapperRow({child: controlsBox, addMargins: false})
            );

            return expanderRow;
        }

        /**
         * Updates gradient preview with current start and end colors
         * Creates 16-step gradient visualization
         * @private
         */
        _updateGradientPreview() {
            const startRgba = this._gradientStartButton.get_rgba();
            const endRgba = this._gradientEndButton.get_rgba();

            const startColor = rgbaToHex(startRgba);
            const endColor = rgbaToHex(endRgba);

            // Clear existing preview
            removeAllChildren(this._gradientPreviewBox);

            // Show gradient preview with 16 color steps
            const colors = generateGradient(startColor, endColor);
            colors.forEach(color => {
                const colorBox = new Gtk.Box({
                    hexpand: true,
                });
                const css = `* { background-color: ${color}; }`;
                applyCssToWidget(colorBox, css);
                this._gradientPreviewBox.append(colorBox);
            });
        }

        /**
         * Generates and emits gradient from current start and end colors
         * Emits 'gradient-generated' signal with 16 color array
         * @private
         */
        _generateGradient() {
            const startRgba = this._gradientStartButton.get_rgba();
            const endRgba = this._gradientEndButton.get_rgba();

            const startColor = rgbaToHex(startRgba);
            const endColor = rgbaToHex(endRgba);

            const colors = generateGradient(startColor, endColor);
            this.emit('gradient-generated', colors);
        }

        /**
         * Creates palette generation from single color section
         * Generates full 16-color ANSI palette from one base color
         * @returns {Adw.ExpanderRow} Palette from color widget
         * @private
         */
        _createPaletteFromColorSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Palette from Single Color',
                subtitle: 'Generate full 16-color palette from one base color',
            });

            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
            });

            // Base color selection row
            const colorRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                halign: Gtk.Align.FILL,
            });

            const colorLabel = new Gtk.Label({
                label: 'Base Color',
                xalign: 0,
                hexpand: true,
            });

            // Color picker button
            const pickColorButton = new Gtk.ColorDialogButton({
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose base color',
            });

            // Set initial color
            const initialColor = new Gdk.RGBA();
            initialColor.parse(this._baseColor);
            pickColorButton.set_rgba(initialColor);

            // Defer dialog creation until widget is realized
            pickColorButton.connect('realize', btn => {
                if (!btn.dialog) {
                    btn.dialog = new Gtk.ColorDialog({with_alpha: false});
                }
            });

            // Update base color when picker changes
            pickColorButton.connect('notify::rgba', btn => {
                const rgba = btn.get_rgba();
                this._baseColor = rgbaToHex(rgba);
            });

            colorRow.append(colorLabel);
            colorRow.append(pickColorButton);
            controlsBox.append(colorRow);

            // Generate button
            const generatePaletteButton = new Gtk.Button({
                label: 'Generate Palette',
                halign: Gtk.Align.CENTER,
                margin_top: SPACING.SM,
                css_classes: ['suggested-action'],
            });
            applyCssToWidget(
                generatePaletteButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 16px;
                }
            `
            );
            generatePaletteButton.connect('clicked', () => {
                const generatedColors = generatePaletteFromColor(
                    this._baseColor
                );
                this.emit('palette-from-color-generated', generatedColors);
            });

            controlsBox.append(generatePaletteButton);

            expanderRow.add_row(
                createWrapperRow({child: controlsBox, addMargins: false})
            );

            return expanderRow;
        }

        /**
         * Creates color presets library section
         * Displays 10 popular themes (Dracula, Nord, Gruvbox, etc.) with color previews
         * @returns {Adw.ExpanderRow} Presets section widget
         * @private
         */
        _createPresetsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Presets',
                subtitle: 'Popular color palettes',
            });

            // Create a ListBox for proper row activation
            const listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE,
                css_classes: ['boxed-list'],
            });

            COLOR_PRESETS.forEach(preset => {
                const presetRow = new Adw.ActionRow({
                    title: preset.name,
                    subtitle: preset.author,
                });

                // Color preview boxes
                const previewBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 2,
                    valign: Gtk.Align.CENTER,
                });

                preset.colors.slice(0, 6).forEach(color => {
                    const colorBox = new Gtk.Box({
                        width_request: 20,
                        height_request: 20,
                    });

                    // Use inline CSS via applyCssToWidget (persists across hide/show)
                    const css = `* {
                        background-color: ${color};
                        border-radius: 0px;
                        min-width: 20px;
                        min-height: 20px;
                        border: 1px solid alpha(currentColor, 0.1);
                    }`;
                    applyCssToWidget(colorBox, css);

                    previewBox.append(colorBox);
                });

                presetRow.add_suffix(previewBox);
                presetRow.set_activatable(true);
                presetRow.connect('activated', () => {
                    this.emit('preset-applied', preset);
                });

                listBox.append(presetRow);
            });

            // Wrap ListBox in scrolled window with fixed height
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                height_request: SIDEBAR.SCROLLED_LIST_HEIGHT,
            });
            scrolled.set_child(listBox);

            expanderRow.add_row(
                createWrapperRow({child: scrolled, addMargins: false})
            );

            return expanderRow;
        }

        /**
         * Creates Neovim theme presets section
         * Displays 37 LazyVim-compatible themes with selection indicators
         * @returns {Adw.ExpanderRow} Neovim presets widget
         * @private
         */
        _createNeovimPresetsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Neovim Themes',
                subtitle: 'LazyVim colorscheme presets',
            });

            // Create a ListBox for proper row activation
            const listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE,
                css_classes: ['boxed-list'],
            });

            NEOVIM_PRESETS.forEach(preset => {
                const presetRow = new Adw.ActionRow({
                    title: preset.name,
                    subtitle: preset.author,
                });

                // Create checkmark icon (initially hidden)
                const checkIcon = new Gtk.Image({
                    icon_name: 'object-select-symbolic',
                    visible: false,
                    valign: Gtk.Align.CENTER,
                });

                presetRow.add_suffix(checkIcon);
                presetRow.set_activatable(true);

                // Store row and icon reference
                this._neovimPresetRows.push({
                    row: presetRow,
                    icon: checkIcon,
                    preset: preset,
                });

                presetRow.connect('activated', () => {
                    const isCurrentlySelected =
                        this._selectedNeovimConfig === preset.config;

                    if (isCurrentlySelected) {
                        this._selectedNeovimConfig = null;
                        checkIcon.set_visible(false);
                        this.emit('neovim-theme-changed', false);
                        showToast(this, `${preset.name} theme deselected`, 2);
                    } else {
                        this._selectedNeovimConfig = preset.config;

                        this._neovimPresetRows.forEach(item => {
                            item.icon.set_visible(false);
                        });

                        checkIcon.set_visible(true);
                        this.emit('neovim-theme-changed', true);
                        showToast(this, `${preset.name} theme selected`, 2);
                    }
                });

                listBox.append(presetRow);
            });

            // Wrap ListBox in scrolled window with fixed height
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                height_request: SIDEBAR.SCROLLED_LIST_HEIGHT,
            });
            scrolled.set_child(listBox);

            expanderRow.add_row(
                createWrapperRow({child: scrolled, addMargins: false})
            );

            return expanderRow;
        }

        /**
         * Creates template settings section
         * Allows enabling/disabling optional templates (Neovim, Zed, VSCode, GTK)
         * GTK includes a clear button to remove theme files when enabled
         * @returns {Adw.ExpanderRow} Template settings widget
         * @private
         */
        _createTemplateSettings() {
            const expanderRow = createExpanderRow({
                title: 'Template Settings',
                subtitle: 'Configure template preferences',
            });

            // Helper to emit settings changed
            const emitSettingsChanged = () => {
                this.emit('settings-changed', this.getSettings());
            };

            // Neovim template
            const {row: neovimRow, switch: neovimSwitch} = createSwitchRow({
                title: 'Include Neovim Template',
                subtitle: 'Copy neovim.lua to theme directory',
                active: this._includeNeovim,
                onChanged: active => {
                    this._includeNeovim = active;
                    emitSettingsChanged();
                },
            });
            this._neovimSwitch = neovimSwitch;
            expanderRow.add_row(neovimRow);

            // Zed template
            const {row: zedRow, switch: zedSwitch} = createSwitchRow({
                title: 'Include Zed Theme',
                subtitle: 'Copy aether.zed.json to ~/.config/zed/themes/',
                active: this._includeZed,
                onChanged: active => {
                    this._includeZed = active;
                    emitSettingsChanged();
                },
            });
            this._zedSwitch = zedSwitch;
            expanderRow.add_row(zedRow);

            // VSCode template
            const {row: vscodeRow, switch: vscodeSwitch} = createSwitchRow({
                title: 'Include VSCode Theme',
                subtitle:
                    'Copy vscode.json to ~/.vscode/extensions/theme-aether/themes/',
                active: this._includeVscode,
                onChanged: active => {
                    this._includeVscode = active;
                    emitSettingsChanged();
                },
            });
            this._vscodeSwitch = vscodeSwitch;
            expanderRow.add_row(vscodeRow);

            // GTK template
            const gtkRow = new Adw.ActionRow({
                title: 'Include GTK Theme',
                subtitle: 'Copy gtk.css to GTK 3.0 and GTK 4.0 config',
            });

            const gtkSuffixBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                valign: Gtk.Align.CENTER,
            });

            this._gtkClearButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                tooltip_text: 'Remove GTK theme files',
                valign: Gtk.Align.CENTER,
                visible: false,
                css_classes: ['flat', 'circular'],
            });

            this._gtkClearButton.connect('clicked', () => {
                this._clearGtkTheme();
            });

            this._gtkSwitch = new Gtk.Switch({
                active: this._includeGtk,
                valign: Gtk.Align.CENTER,
            });

            this._gtkSwitch.connect('notify::active', sw => {
                this._includeGtk = sw.get_active();
                this._gtkClearButton.set_visible(this._includeGtk);
                emitSettingsChanged();
            });

            this._gtkClearButton.set_visible(this._includeGtk);

            gtkSuffixBox.append(this._gtkClearButton);
            gtkSuffixBox.append(this._gtkSwitch);

            gtkRow.add_suffix(gtkSuffixBox);
            gtkRow.set_activatable_widget(this._gtkSwitch);

            expanderRow.add_row(gtkRow);

            return expanderRow;
        }

        /**
         * Creates font selector section with preview and download functionality
         * Allows browsing installed fonts and downloading popular programming fonts
         * @returns {Adw.ExpanderRow} Font selector widget
         * @private
         */
        _createFontSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Font Manager',
                subtitle: 'Select and download fonts for terminals and editors',
            });

            // Create font selector
            this._fontSelector = new FontSelector();

            // Wrap in a box with padding
            const fontBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
            });

            fontBox.append(this._fontSelector);

            // Add to expander as a child
            expanderRow.add_row(
                createWrapperRow({child: fontBox, addMargins: false})
            );

            return expanderRow;
        }

        /**
         * Clears GTK theme files from GTK 3.0 and 4.0 config directories
         * Removes gtk.css files when user disables GTK theming
         * @private
         */
        _clearGtkTheme() {
            const configDir = GLib.get_user_config_dir();
            const paths = [
                GLib.build_filenamev([configDir, 'gtk-3.0', 'gtk.css']),
                GLib.build_filenamev([configDir, 'gtk-4.0', 'gtk.css']),
            ];

            paths.forEach(path => {
                const file = Gio.File.new_for_path(path);
                try {
                    if (file.query_exists(null)) {
                        file.delete(null);
                    }
                } catch (e) {
                    console.error(`Failed to remove ${path}:`, e.message);
                }
            });

            // Show checkmark feedback
            this._gtkClearButton.set_icon_name('object-select-symbolic');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                this._gtkClearButton.set_icon_name('user-trash-symbolic');
                return GLib.SOURCE_REMOVE;
            });
        }

        /**
         * Resets all color adjustments to default values
         * @public
         */
        resetAdjustments() {
            this._adjustmentControls.reset();
        }

        /**
         * Updates accessibility panel with current color palette
         * @param {Object} colors - Color role assignments
         * @public
         */
        updateAccessibility(colors) {
            this._accessibilityPanel.updateColors(colors);
        }

        /**
         * Gets current template and feature settings
         * @returns {Object} Settings object with template enable flags
         * @public
         */
        getSettings() {
            return {
                includeNeovim: this._includeNeovim,
                includeZed: this._includeZed,
                includeVscode: this._includeVscode,
                includeGtk: this._includeGtk,
                lightMode: this._lightMode,
                selectedNeovimConfig: this._selectedNeovimConfig,
            };
        }

        /**
         * Loads persisted settings from disk
         * Reads from ~/.config/aether/settings.json
         * @private
         */
        _loadSettings() {
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            ensureDirectoryExists(configDir);

            const settings = loadJsonFile(this._settingsPath);
            if (settings) {
                this._includeNeovim = settings.includeNeovim ?? true;
                this._includeZed = settings.includeZed ?? false;
                this._includeVscode = settings.includeVscode ?? false;
                this._includeGtk = settings.includeGtk ?? false;
                console.log('Loaded settings from', this._settingsPath);
            }
        }

        /**
         * Saves current settings to disk
         * Writes to ~/.config/aether/settings.json
         * @public
         */
        saveSettings() {
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            ensureDirectoryExists(configDir);

            const settings = {
                includeNeovim: this._includeNeovim,
                includeZed: this._includeZed,
                includeVscode: this._includeVscode,
                includeGtk: this._includeGtk,
            };

            const success = saveJsonFile(this._settingsPath, settings);
            if (success) {
                console.log('Saved settings to', this._settingsPath);
            }
        }

        setLightMode(lightMode) {
            this._lightMode = lightMode;
            this._lightModeSwitch.set_active(lightMode);
        }

        getLightMode() {
            return this._lightMode;
        }

        /**
         * Updates the visual selection state of Neovim preset rows
         * @param {string|null} config - The config name to select, or null to clear selection
         * @private
         */
        _updateNeovimPresetSelection(config) {
            if (!this._neovimPresetRows) return;

            this._neovimPresetRows.forEach(item => {
                item.icon.set_visible(config && item.preset.config === config);
            });
        }

        setNeovimTheme(config) {
            this._selectedNeovimConfig = config;
            this._updateNeovimPresetSelection(config);
            this.emit('neovim-theme-changed', Boolean(config));
        }

        get widget() {
            return this;
        }
    }
);
