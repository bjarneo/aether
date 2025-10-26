import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {ColorAdjustmentControls} from './palette/color-adjustment-controls.js';
import {AccessibilityPanel} from './AccessibilityPanel.js';
import {ShaderManager} from './ShaderManager.js';
import {COLOR_PRESETS} from '../constants/presets.js';
import {NEOVIM_PRESETS} from '../constants/neovim-presets.js';
import {applyCssToWidget, removeAllChildren} from '../utils/ui-helpers.js';
import {
    rgbaToHex,
    generatePaletteFromColor,
    generateGradient,
} from '../utils/color-utils.js';
import {loadJsonFile, saveJsonFile} from '../utils/file-utils.js';

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
            'app-overrides-enabled-changed': {
                param_types: [GObject.TYPE_BOOLEAN],
            },
            'neovim-theme-changed': {param_types: [GObject.TYPE_BOOLEAN]},
        },
    },
    class SettingsSidebar extends Gtk.Box {
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
            this._includeVencord = false;
            this._includeZed = false;
            this._includeVscode = false;
            this._includeGtk = false;
            this._lightMode = false;
            this._selectedNeovimConfig = null;
            this._neovimPresetRows = []; // Store references to preset rows for visual feedback
            this._baseColor = '#89b4fa'; // Default base color for palette generation
            this._enableAppOverrides = false; // Per-app color overrides (experimental)

            // Load persisted settings
            this._loadSettings();

            this._initializeUI();
        }

        _initializeUI() {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
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

            // Shader Manager Section
            this._shaderManager = new ShaderManager();
            contentBox.append(this._shaderManager);

            // Template Settings Section
            const templateSettings = this._createTemplateSettings();
            contentBox.append(templateSettings);

            // Experimental Section
            const experimentalSettings = this._createExperimentalSettings();
            contentBox.append(experimentalSettings);

            // Accessibility Section (at bottom)
            this._accessibilityPanel = new AccessibilityPanel();
            contentBox.append(this._accessibilityPanel);

            scrolled.set_child(contentBox);
            this.append(scrolled);
        }

        _createLightModeSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Theme Mode',
            });

            const lightModeRow = new Adw.ActionRow({
                title: 'Light Mode',
                subtitle: 'Generate light color scheme',
            });

            this._lightModeSwitch = new Gtk.Switch({
                active: this._lightMode,
                valign: Gtk.Align.CENTER,
            });

            this._lightModeSwitch.connect('notify::active', sw => {
                this._lightMode = sw.get_active();
                this.emit('light-mode-changed', this._lightMode);
            });

            lightModeRow.add_suffix(this._lightModeSwitch);
            lightModeRow.set_activatable_widget(this._lightModeSwitch);

            group.add(lightModeRow);

            return group;
        }

        _createAdjustmentsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Color Adjustments',
                subtitle: 'Fine-tune your palette',
                expanded: true, // Open by default
            });

            this._adjustmentControls = new ColorAdjustmentControls(
                values => this.emit('adjustments-changed', values),
                () => this.emit('adjustments-reset')
            );

            const controlsWrapper = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
                margin_bottom: 6,
            });
            controlsWrapper.append(this._adjustmentControls.widget);

            expanderRow.add_row(new Adw.ActionRow({child: controlsWrapper}));

            return expanderRow;
        }

        _createGradientSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Gradient Generator',
                subtitle: 'Create smooth color gradients',
            });

            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 12,
                margin_bottom: 12,
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
                margin_top: 12,
                height_request: 40,
                css_classes: ['card'],
            });
            controlsBox.append(this._gradientPreviewBox);

            // Generate button
            const generateButton = new Gtk.Button({
                label: 'Generate Palette',
                halign: Gtk.Align.CENTER,
                margin_top: 6,
                css_classes: ['suggested-action'],
            });
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

            expanderRow.add_row(new Adw.ActionRow({child: controlsBox}));

            return expanderRow;
        }

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

        _generateGradient() {
            const startRgba = this._gradientStartButton.get_rgba();
            const endRgba = this._gradientEndButton.get_rgba();

            const startColor = rgbaToHex(startRgba);
            const endColor = rgbaToHex(endRgba);

            const colors = generateGradient(startColor, endColor);
            this.emit('gradient-generated', colors);
        }

        _createPaletteFromColorSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Palette from Single Color',
                subtitle: 'Generate full 16-color palette from one base color',
            });

            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 12,
                margin_bottom: 12,
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
            const generateButton = new Gtk.Button({
                label: 'Generate Palette',
                halign: Gtk.Align.CENTER,
                margin_top: 6,
                css_classes: ['suggested-action'],
            });
            generateButton.connect('clicked', () => {
                const generatedColors = generatePaletteFromColor(
                    this._baseColor
                );
                this.emit('palette-from-color-generated', generatedColors);
            });

            controlsBox.append(generateButton);

            expanderRow.add_row(new Adw.ActionRow({child: controlsBox}));

            return expanderRow;
        }

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

            COLOR_PRESETS.forEach((preset, presetIndex) => {
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

                preset.colors.slice(0, 6).forEach((color, colorIndex) => {
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
                height_request: 300,
            });
            scrolled.set_child(listBox);

            expanderRow.add_row(new Adw.ActionRow({child: scrolled}));

            return expanderRow;
        }

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

            NEOVIM_PRESETS.forEach((preset, index) => {
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

                        const toast = new Adw.Toast({
                            title: `${preset.name} theme deselected`,
                            timeout: 2,
                        });

                        let widget = this;
                        while (widget) {
                            if (widget._toastOverlay) {
                                widget._toastOverlay.add_toast(toast);
                                break;
                            }
                            widget = widget.get_parent();
                        }
                    } else {
                        this._selectedNeovimConfig = preset.config;

                        this._neovimPresetRows.forEach(item => {
                            item.icon.set_visible(false);
                        });

                        checkIcon.set_visible(true);
                        this.emit('neovim-theme-changed', true);

                        const toast = new Adw.Toast({
                            title: `${preset.name} theme selected`,
                            timeout: 2,
                        });

                        let widget = this;
                        while (widget) {
                            if (widget._toastOverlay) {
                                widget._toastOverlay.add_toast(toast);
                                break;
                            }
                            widget = widget.get_parent();
                        }
                    }
                });

                listBox.append(presetRow);
            });

            // Wrap ListBox in scrolled window with fixed height
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                height_request: 300,
            });
            scrolled.set_child(listBox);

            expanderRow.add_row(new Adw.ActionRow({child: scrolled}));

            return expanderRow;
        }

        _createTemplateSettings() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Template Settings',
                subtitle: 'Configure template preferences',
            });

            const neovimRow = new Adw.ActionRow({
                title: 'Include Neovim Template',
                subtitle: 'Copy neovim.lua to theme directory',
            });

            this._neovimSwitch = new Gtk.Switch({
                active: this._includeNeovim,
                valign: Gtk.Align.CENTER,
            });

            this._neovimSwitch.connect('notify::active', sw => {
                this._includeNeovim = sw.get_active();
                this.emit('settings-changed', this.getSettings());
            });

            neovimRow.add_suffix(this._neovimSwitch);
            neovimRow.set_activatable_widget(this._neovimSwitch);

            expanderRow.add_row(neovimRow);

            const vencordRow = new Adw.ActionRow({
                title: 'Include Vencord Theme',
                subtitle: 'Copy vencord.theme.css to theme directory',
            });

            this._vencordSwitch = new Gtk.Switch({
                active: this._includeVencord,
                valign: Gtk.Align.CENTER,
            });

            this._vencordSwitch.connect('notify::active', sw => {
                this._includeVencord = sw.get_active();
                this.emit('settings-changed', this.getSettings());
            });

            vencordRow.add_suffix(this._vencordSwitch);
            vencordRow.set_activatable_widget(this._vencordSwitch);

            expanderRow.add_row(vencordRow);

            const zedRow = new Adw.ActionRow({
                title: 'Include Zed Theme',
                subtitle: 'Copy aether.zed.json to ~/.config/zed/themes/',
            });

            this._zedSwitch = new Gtk.Switch({
                active: this._includeZed,
                valign: Gtk.Align.CENTER,
            });

            this._zedSwitch.connect('notify::active', sw => {
                this._includeZed = sw.get_active();
                this.emit('settings-changed', this.getSettings());
            });

            zedRow.add_suffix(this._zedSwitch);
            zedRow.set_activatable_widget(this._zedSwitch);

            expanderRow.add_row(zedRow);

            const vscodeRow = new Adw.ActionRow({
                title: 'Include VSCode Theme',
                subtitle:
                    'Copy vscode.json to ~/.vscode/extensions/theme-aether/themes/',
            });

            this._vscodeSwitch = new Gtk.Switch({
                active: this._includeVscode,
                valign: Gtk.Align.CENTER,
            });

            this._vscodeSwitch.connect('notify::active', sw => {
                this._includeVscode = sw.get_active();
                this.emit('settings-changed', this.getSettings());
            });

            vscodeRow.add_suffix(this._vscodeSwitch);
            vscodeRow.set_activatable_widget(this._vscodeSwitch);

            expanderRow.add_row(vscodeRow);

            return expanderRow;
        }

        _createExperimentalSettings() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Experimental',
                subtitle: 'Features that might or might not be part of Aether',
            });

            // GTK Theming row
            const gtkRow = new Adw.ActionRow({
                title: 'Include GTK Theming',
            });

            // Add info button with description
            const gtkInfoButton = new Gtk.Button({
                icon_name: 'help-about-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Copy gtk.css to GTK 3.0 and GTK 4.0 config',
                css_classes: ['flat', 'circular'],
            });

            // Create a box to hold the info button, clear button, and switch
            const suffixBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

            suffixBox.append(gtkInfoButton);

            // Create clear button (initially hidden)
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
                // Show/hide clear button based on switch state
                this._gtkClearButton.set_visible(this._includeGtk);
                this.emit('settings-changed', this.getSettings());
            });

            // Set initial visibility of clear button
            this._gtkClearButton.set_visible(this._includeGtk);

            suffixBox.append(this._gtkClearButton);
            suffixBox.append(this._gtkSwitch);

            gtkRow.add_suffix(suffixBox);
            gtkRow.set_activatable_widget(this._gtkSwitch);

            expanderRow.add_row(gtkRow);

            // Per-Application Color Overrides row
            const appOverridesRow = new Adw.ActionRow({
                title: 'Per-Application Color Overrides',
                subtitle: 'Customize colors for specific apps',
            });

            const appOverridesInfoButton = new Gtk.Button({
                icon_name: 'help-about-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text:
                    'Override color variables for individual application templates',
                css_classes: ['flat', 'circular'],
            });

            const appOverridesSuffixBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

            appOverridesSuffixBox.append(appOverridesInfoButton);

            this._appOverridesSwitch = new Gtk.Switch({
                active: this._enableAppOverrides,
                valign: Gtk.Align.CENTER,
            });

            this._appOverridesSwitch.connect('notify::active', sw => {
                this._enableAppOverrides = sw.get_active();
                this.emit(
                    'app-overrides-enabled-changed',
                    this._enableAppOverrides
                );
                this.emit('settings-changed', this.getSettings());
            });

            appOverridesSuffixBox.append(this._appOverridesSwitch);

            appOverridesRow.add_suffix(appOverridesSuffixBox);
            appOverridesRow.set_activatable_widget(this._appOverridesSwitch);

            expanderRow.add_row(appOverridesRow);

            return expanderRow;
        }

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

        resetAdjustments() {
            this._adjustmentControls.reset();
        }

        updateAccessibility(colors) {
            this._accessibilityPanel.updateColors(colors);
        }

        getSettings() {
            return {
                includeNeovim: this._includeNeovim,
                includeVencord: this._includeVencord,
                includeZed: this._includeZed,
                includeVscode: this._includeVscode,
                includeGtk: this._includeGtk,
                lightMode: this._lightMode,
                selectedNeovimConfig: this._selectedNeovimConfig,
                enableAppOverrides: this._enableAppOverrides,
            };
        }

        _loadSettings() {
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            GLib.mkdir_with_parents(configDir, 0o755);

            const settings = loadJsonFile(this._settingsPath);
            if (settings) {
                this._includeNeovim = settings.includeNeovim ?? true;
                this._includeVencord = settings.includeVencord ?? false;
                this._includeZed = settings.includeZed ?? false;
                this._includeVscode = settings.includeVscode ?? false;
                this._includeGtk = settings.includeGtk ?? false;
                this._enableAppOverrides = settings.enableAppOverrides ?? false;
                console.log('Loaded settings from', this._settingsPath);
            }
        }

        saveSettings() {
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            GLib.mkdir_with_parents(configDir, 0o755);

            const settings = {
                includeNeovim: this._includeNeovim,
                includeVencord: this._includeVencord,
                includeZed: this._includeZed,
                includeVscode: this._includeVscode,
                includeGtk: this._includeGtk,
                enableAppOverrides: this._enableAppOverrides,
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

        setNeovimTheme(config) {
            // Set the selected neovim config and update visual feedback
            this._selectedNeovimConfig = config;

            // Find and mark the matching theme
            if (config && this._neovimPresetRows) {
                this._neovimPresetRows.forEach(item => {
                    if (item.preset.config === config) {
                        item.icon.set_visible(true);
                    } else {
                        item.icon.set_visible(false);
                    }
                });
                this.emit('neovim-theme-changed', true);
            } else {
                // Clear all selections
                this._neovimPresetRows?.forEach(item => {
                    item.icon.set_visible(false);
                });
                this.emit('neovim-theme-changed', false);
            }
        }

        get widget() {
            return this;
        }
    }
);
