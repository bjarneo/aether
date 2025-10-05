import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import { ColorAdjustmentControls } from './palette/color-adjustment-controls.js';
import { AccessibilityPanel } from './AccessibilityPanel.js';
import { COLOR_PRESETS } from '../constants/presets.js';
import { applyCssToWidget } from '../utils/ui-helpers.js';

export const SettingsSidebar = GObject.registerClass({
    Signals: {
        'adjustments-changed': { param_types: [GObject.TYPE_JSOBJECT] },
        'adjustments-reset': {},
        'settings-changed': { param_types: [GObject.TYPE_JSOBJECT] },
        'preset-applied': { param_types: [GObject.TYPE_JSOBJECT] },
    },
}, class SettingsSidebar extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        this._includeNeovim = true;
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

        // Color Adjustments Section
        const adjustmentsLabel = new Gtk.Label({
            label: 'Color Adjustments',
            halign: Gtk.Align.START,
            css_classes: ['heading'],
            margin_bottom: 6,
        });
        contentBox.append(adjustmentsLabel);

        this._adjustmentControls = new ColorAdjustmentControls(
            (values) => this.emit('adjustments-changed', values),
            () => this.emit('adjustments-reset')
        );
        this._adjustmentControls.show(); // Make sliders visible

        contentBox.append(this._adjustmentControls.widget);

        // Accessibility Section
        this._accessibilityPanel = new AccessibilityPanel();
        contentBox.append(this._accessibilityPanel);

        // Presets Section
        const presetsSection = this._createPresetsSection();
        contentBox.append(presetsSection);

        // Template Settings Section
        const templateSettings = this._createTemplateSettings();
        contentBox.append(templateSettings);

        scrolled.set_child(contentBox);
        this.append(scrolled);
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
                const css = `* { background-color: ${color}; border-radius: 3px; }`;
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

    showAdjustments() {
        this._adjustmentControls.show();
    }

    updateAccessibility(colors) {
        this._accessibilityPanel.updateColors(colors);
    }

    getSettings() {
        return {
            includeNeovim: this._includeNeovim,
        };
    }

    get widget() {
        return this;
    }
});
