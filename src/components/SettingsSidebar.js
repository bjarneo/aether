import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {ColorAdjustmentControls} from './palette/color-adjustment-controls.js';
import {AccessibilityPanel} from './AccessibilityPanel.js';
import {COLOR_PRESETS} from '../constants/presets.js';
import {NEOVIM_PRESETS} from '../constants/neovim-presets.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {rgbaToHex, generatePaletteFromColor} from '../utils/color-utils.js';
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
            'palette-from-color-generated': {param_types: [GObject.TYPE_JSOBJECT]},
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
            this._includeGtk = false;
            this._lightMode = false;
            this._selectedNeovimConfig = null;
            this._neovimPresetRows = []; // Store references to preset rows for visual feedback
            this._baseColor = '#89b4fa'; // Default base color for palette generation

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

            // Presets Section
            const presetsSection = this._createPresetsSection();
            contentBox.append(presetsSection);

            // Neovim Themes Section
            const neovimSection = this._createNeovimPresetsSection();
            contentBox.append(neovimSection);

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
            let child = this._gradientPreviewBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._gradientPreviewBox.remove(child);
                child = next;
            }

            // Show gradient preview with 16 color steps
            const colors = this._generateGradientColors(startColor, endColor);
            colors.forEach(color => {
                const colorBox = new Gtk.Box({
                    hexpand: true,
                });
                const css = `* { background-color: ${color}; }`;
                applyCssToWidget(colorBox, css);
                this._gradientPreviewBox.append(colorBox);
            });
        }

        _generateGradientColors(startColor, endColor) {
            // Parse hex colors to RGB
            const start = {
                r: parseInt(startColor.slice(1, 3), 16),
                g: parseInt(startColor.slice(3, 5), 16),
                b: parseInt(startColor.slice(5, 7), 16),
            };

            const end = {
                r: parseInt(endColor.slice(1, 3), 16),
                g: parseInt(endColor.slice(3, 5), 16),
                b: parseInt(endColor.slice(5, 7), 16),
            };

            const colors = [];

            // Generate 16 color steps
            for (let i = 0; i < 16; i++) {
                const ratio = i / 15;
                const r = Math.round(start.r + (end.r - start.r) * ratio);
                const g = Math.round(start.g + (end.g - start.g) * ratio);
                const b = Math.round(start.b + (end.b - start.b) * ratio);

                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                colors.push(hex);
            }

            return colors;
        }

        _generateGradient() {
            const startRgba = this._gradientStartButton.get_rgba();
            const endRgba = this._gradientEndButton.get_rgba();

            const startColor = rgbaToHex(startRgba);
            const endColor = rgbaToHex(endRgba);

            const colors = this._generateGradientColors(startColor, endColor);
            this.emit('gradient-generated', colors);
        }

        _createPresetsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Presets',
                subtitle: 'Popular color palettes',
            });

            // Create container box for all preset rows
            const presetsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
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

                presetsBox.append(presetRow);
            });

            // Wrap in scrolled window with max height
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                max_content_height: 300,
                propagate_natural_height: true,
            });
            scrolled.set_child(presetsBox);

            expanderRow.add_row(new Adw.ActionRow({child: scrolled}));

            return expanderRow;
        }

        _createNeovimPresetsSection() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Neovim Themes',
                subtitle: 'LazyVim colorscheme presets',
            });

            // Create container box for all neovim preset rows
            const neovimBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
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
                    // Toggle selection: if already selected, deselect it
                    const isCurrentlySelected =
                        this._selectedNeovimConfig === preset.config;

                    if (isCurrentlySelected) {
                        // Deselect
                        this._selectedNeovimConfig = null;
                        checkIcon.set_visible(false);

                        this.emit('settings-changed', this.getSettings());

                        // Visual feedback toast
                        const toast = new Adw.Toast({
                            title: `${preset.name} theme deselected`,
                            timeout: 2,
                        });

                        // Try to show toast if parent window has overlay
                        let widget = this;
                        while (widget) {
                            if (widget._toastOverlay) {
                                widget._toastOverlay.add_toast(toast);
                                break;
                            }
                            widget = widget.get_parent();
                        }
                    } else {
                        // Select
                        this._selectedNeovimConfig = preset.config;

                        // Clear all checkmarks
                        this._neovimPresetRows.forEach(item => {
                            item.icon.set_visible(false);
                        });

                        // Show checkmark on selected theme
                        checkIcon.set_visible(true);

                        this.emit('settings-changed', this.getSettings());

                        // Visual feedback toast
                        const toast = new Adw.Toast({
                            title: `${preset.name} theme selected`,
                            timeout: 2,
                        });

                        // Try to show toast if parent window has overlay
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

                neovimBox.append(presetRow);
            });

            // Wrap in scrolled window with max height
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                max_content_height: 300,
                propagate_natural_height: true,
            });
            scrolled.set_child(neovimBox);

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

            return expanderRow;
        }

        _createExperimentalSettings() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Experimental',
                subtitle: 'Features that might or might not be part of Aether',
            });

            // Single color palette generator
            const colorGenRow = new Adw.ActionRow({
                title: 'Generate from Single Color',
                subtitle: 'Create full 16-color palette from one base color',
            });

            // Color preview box
            this._baseColorPreview = new Gtk.Box({
                width_request: 40,
                height_request: 40,
                valign: Gtk.Align.CENTER,
                css_classes: ['card'],
            });
            applyCssToWidget(this._baseColorPreview, `
                * {
                    background-color: ${this._baseColor};
                    border-radius: 0px;
                }
            `);

            // Color picker button
            const pickColorButton = new Gtk.Button({
                icon_name: 'color-select-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Pick base color',
            });
            pickColorButton.connect('clicked', () => this._pickBaseColor());

            // Generate button
            const generateButton = new Gtk.Button({
                label: 'Generate',
                css_classes: ['suggested-action'],
                valign: Gtk.Align.CENTER,
            });
            generateButton.connect('clicked', () => this._generateFromBaseColor());

            colorGenRow.add_suffix(this._baseColorPreview);
            colorGenRow.add_suffix(pickColorButton);
            colorGenRow.add_suffix(generateButton);

            expanderRow.add_row(colorGenRow);

            // GTK Theming row
            const gtkRow = new Adw.ActionRow({
                title: 'Include GTK Theming',
                subtitle: 'Copy gtk.css to GTK 3.0 and GTK 4.0 config',
            });

            // Create a box to hold both the clear button and switch
            const suffixBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

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

            return expanderRow;
        }

        _pickBaseColor() {
            const dialog = new Gtk.ColorDialog();
            const currentRgba = new Gdk.RGBA();
            currentRgba.parse(this._baseColor);

            dialog.choose_rgba(this.get_root(), currentRgba, null, (source, result) => {
                const rgba = dialog.choose_rgba_finish(result);
                if (!rgba) return;

                // Convert RGBA to hex
                const r = Math.round(rgba.red * 255);
                const g = Math.round(rgba.green * 255);
                const b = Math.round(rgba.blue * 255);
                this._baseColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

                // Update preview box
                applyCssToWidget(this._baseColorPreview, `
                    * {
                        background-color: ${this._baseColor};
                        border-radius: 0px;
                    }
                `);
            });
        }

        _generateFromBaseColor() {
            const generatedColors = generatePaletteFromColor(this._baseColor);
            this.emit('palette-from-color-generated', generatedColors);
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
                includeGtk: this._includeGtk,
                lightMode: this._lightMode,
                selectedNeovimConfig: this._selectedNeovimConfig,
            };
        }

        _loadSettings() {
            // Ensure config directory exists
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            GLib.mkdir_with_parents(configDir, 0o755);

            const settings = loadJsonFile(this._settingsPath);
            if (settings) {
                this._includeNeovim = settings.includeNeovim ?? true;
                this._includeVencord = settings.includeVencord ?? false;
                this._includeGtk = settings.includeGtk ?? false;
                this._selectedNeovimConfig = settings.selectedNeovimConfig ?? null;
                console.log('Loaded settings from', this._settingsPath);
            }
        }

        saveSettings() {
            // Ensure config directory exists
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            GLib.mkdir_with_parents(configDir, 0o755);

            const settings = {
                includeNeovim: this._includeNeovim,
                includeVencord: this._includeVencord,
                includeGtk: this._includeGtk,
                selectedNeovimConfig: this._selectedNeovimConfig,
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
            } else {
                // Clear all selections
                this._neovimPresetRows?.forEach(item => {
                    item.icon.set_visible(false);
                });
            }
        }

        get widget() {
            return this;
        }
    }
);
