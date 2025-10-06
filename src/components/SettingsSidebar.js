import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { ColorAdjustmentControls } from './palette/color-adjustment-controls.js';
import { AccessibilityPanel } from './AccessibilityPanel.js';
import { COLOR_PRESETS } from '../constants/presets.js';
import { applyCssToWidget } from '../utils/ui-helpers.js';
import { generateHarmony } from '../services/color-harmony.js';
import { rgbaToHex } from '../utils/color-utils.js';

export const SettingsSidebar = GObject.registerClass({
    Signals: {
        'adjustments-changed': { param_types: [GObject.TYPE_JSOBJECT] },
        'adjustments-reset': {},
        'settings-changed': { param_types: [GObject.TYPE_JSOBJECT] },
        'preset-applied': { param_types: [GObject.TYPE_JSOBJECT] },
        'harmony-generated': { param_types: [GObject.TYPE_JSOBJECT] },
        'gradient-generated': { param_types: [GObject.TYPE_JSOBJECT] },
        'light-mode-changed': { param_types: [GObject.TYPE_BOOLEAN] },
    },
}, class SettingsSidebar extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        this._includeNeovim = true;
        this._lightMode = false;
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

        // Color Harmony Section
        const harmonySection = this._createHarmonySection();
        contentBox.append(harmonySection);

        // Gradient Generator Section
        const gradientSection = this._createGradientSection();
        contentBox.append(gradientSection);

        // Presets Section
        const presetsSection = this._createPresetsSection();
        contentBox.append(presetsSection);

        // Template Settings Section
        const templateSettings = this._createTemplateSettings();
        contentBox.append(templateSettings);

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

        this._lightModeSwitch.connect('notify::active', (sw) => {
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
            (values) => this.emit('adjustments-changed', values),
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

        expanderRow.add_row(new Adw.ActionRow({ child: controlsWrapper }));

        return expanderRow;
    }

    _createHarmonySection() {
        const expanderRow = new Adw.ExpanderRow({
            title: 'Color Harmony',
            subtitle: 'Generate palette from color theory',
        });

        const controlsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        // Base color selection
        const baseColorRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL,
        });

        const baseColorLabel = new Gtk.Label({
            label: 'Base Color',
            xalign: 0,
            hexpand: true,
        });

        this._baseColorButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose base color',
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
        });

        const initialColor = new Gdk.RGBA();
        initialColor.parse('#4a86e8');
        this._baseColorButton.set_rgba(initialColor);

        baseColorRow.append(baseColorLabel);
        baseColorRow.append(this._baseColorButton);
        controlsBox.append(baseColorRow);

        // Harmony type selection
        const harmonyTypeLabel = new Gtk.Label({
            label: 'Harmony Type',
            xalign: 0,
            margin_top: 6,
            css_classes: ['heading'],
        });
        controlsBox.append(harmonyTypeLabel);

        const harmonyDescriptions = [
            'Complementary - Opposite colors on color wheel',
            'Analogous - Adjacent colors on color wheel',
            'Triadic - Three evenly spaced colors',
            'Split Complementary - Base + two adjacent to complement',
            'Tetradic - Four colors in two complementary pairs',
            'Monochromatic - Variations of single hue'
        ];

        const harmonyTypes = new Gtk.StringList();
        harmonyDescriptions.forEach(desc => harmonyTypes.append(desc));

        this._harmonyDropdown = new Gtk.DropDown({
            model: harmonyTypes,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        controlsBox.append(this._harmonyDropdown);

        // Preview colors box
        this._harmonyPreviewBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            margin_top: 12,
            height_request: 40,
            homogeneous: true,
        });
        controlsBox.append(this._harmonyPreviewBox);

        // Generate button
        const generateButton = new Gtk.Button({
            label: 'Generate Palette',
            halign: Gtk.Align.CENTER,
            margin_top: 6,
            css_classes: ['suggested-action'],
        });
        generateButton.connect('clicked', () => this._generateHarmony());

        controlsBox.append(generateButton);

        // Update preview when base color or harmony type changes
        this._baseColorButton.connect('notify::rgba', () => this._updateHarmonyPreview());
        this._harmonyDropdown.connect('notify::selected', () => this._updateHarmonyPreview());

        // Initialize preview
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._updateHarmonyPreview();
            return GLib.SOURCE_REMOVE;
        });

        expanderRow.add_row(new Adw.ActionRow({ child: controlsBox }));

        return expanderRow;
    }

    _updateHarmonyPreview() {
        const rgba = this._baseColorButton.get_rgba();
        const baseColor = rgbaToHex(rgba);
        const harmonyType = this._harmonyDropdown.get_selected();

        // Clear existing preview
        let child = this._harmonyPreviewBox.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._harmonyPreviewBox.remove(child);
            child = next;
        }

        // Generate preview colors
        const colors = generateHarmony(baseColor, harmonyType);

        // Show first 6 colors as preview
        colors.slice(0, 6).forEach(color => {
            const colorBox = new Gtk.Box({
                css_classes: ['card'],
                hexpand: true,
            });
            const css = `* { background-color: ${color}; border-radius: 0px; }`;
            applyCssToWidget(colorBox, css);
            this._harmonyPreviewBox.append(colorBox);
        });
    }

    _generateHarmony() {
        const rgba = this._baseColorButton.get_rgba();
        const baseColor = rgbaToHex(rgba);
        const harmonyType = this._harmonyDropdown.get_selected();

        const colors = generateHarmony(baseColor, harmonyType);
        this.emit('harmony-generated', colors);
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

        this._gradientStartButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose start color',
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
        });

        const startColor = new Gdk.RGBA();
        startColor.parse('#1e1e2e');
        this._gradientStartButton.set_rgba(startColor);

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

        this._gradientEndButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose end color',
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
        });

        const endColor = new Gdk.RGBA();
        endColor.parse('#cdd6f4');
        this._gradientEndButton.set_rgba(endColor);

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
        this._gradientStartButton.connect('notify::rgba', () => this._updateGradientPreview());
        this._gradientEndButton.connect('notify::rgba', () => this._updateGradientPreview());

        // Initialize preview
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._updateGradientPreview();
            return GLib.SOURCE_REMOVE;
        });

        expanderRow.add_row(new Adw.ActionRow({ child: controlsBox }));

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

        COLOR_PRESETS.forEach((preset) => {
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
                    css_classes: ['card'],
                });
                const css = `* { background-color: ${color}; border-radius: 0px; }`;
                applyCssToWidget(colorBox, css);
                previewBox.append(colorBox);
            });

            presetRow.add_suffix(previewBox);
            presetRow.set_activatable(true);
            presetRow.connect('activated', () => {
                this.emit('preset-applied', preset);
            });

            expanderRow.add_row(presetRow);
        });

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

        const neovimSwitch = new Gtk.Switch({
            active: this._includeNeovim,
            valign: Gtk.Align.CENTER,
        });

        neovimSwitch.connect('notify::active', (sw) => {
            this._includeNeovim = sw.get_active();
            this.emit('settings-changed', this.getSettings());
        });

        neovimRow.add_suffix(neovimSwitch);
        neovimRow.set_activatable_widget(neovimSwitch);

        expanderRow.add_row(neovimRow);

        return expanderRow;
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
            lightMode: this._lightMode,
        };
    }

    setLightMode(lightMode) {
        this._lightMode = lightMode;
        this._lightModeSwitch.set_active(lightMode);
    }

    getLightMode() {
        return this._lightMode;
    }

    get widget() {
        return this;
    }
});
