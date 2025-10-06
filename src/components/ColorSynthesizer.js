import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { rgbaToHex } from '../utils/color-utils.js';
import { applyCssToWidget, forEachChild } from '../utils/ui-helpers.js';
import { ANSI_COLOR_ROLES, DEFAULT_COLORS } from '../constants/colors.js';

export const ColorSynthesizer = GObject.registerClass({
    Signals: {
        'color-changed': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING]
        },
    },
}, class ColorSynthesizer extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        this._palette = [];
        this._colorRoles = new Map();

        this._listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });

        ANSI_COLOR_ROLES.forEach(role => {
            const row = this._createColorRoleRow(role);
            this._listBox.append(row);
        });

        this.append(this._listBox);
        this._initializeDefaults();
    }

    _createColorRoleRow(role) {
        const row = new Adw.ActionRow({
            title: role.label,
            subtitle: role.description,
        });

        const colorButton = this._createColorButton(role);
        row.add_suffix(colorButton);

        // Store references for later updates
        row._colorButton = colorButton;
        row._roleId = role.id;

        return row;
    }

    _createColorButton(role) {
        const colorButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose color',
            dialog: new Gtk.ColorDialog({ with_alpha: true }),
        });

        const initialColor = new Gdk.RGBA();
        initialColor.parse('#808080');
        colorButton.set_rgba(initialColor);

        colorButton.connect('notify::rgba', () => {
            const rgba = colorButton.get_rgba();
            const hex = rgbaToHex(rgba);
            this._colorRoles.set(role.id, hex);
            this.emit('color-changed', role.id, hex);
            this._updateColorButtonStyle(colorButton, hex);
        });

        return colorButton;
    }

    _updateColorButtonStyle(button, hexColor) {
        const css = `
            .color-button-custom {
                background-color: ${hexColor};
                min-width: 48px;
                min-height: 32px;
                border-radius: 0px;
            }
        `;
        applyCssToWidget(button, css);
    }

    setPalette(colors) {
        this._palette = colors;
        this._autoAssignColors();
    }

    _autoAssignColors() {
        if (this._palette.length < 16) return;

        const assignments = this._createColorAssignments();

        forEachChild(this._listBox, (childRow) => {
            const roleId = childRow._roleId;
            const colorButton = childRow._colorButton;
            const assignedColor = assignments[roleId];

            if (!assignedColor) return;

            const color = new Gdk.RGBA();
            color.parse(assignedColor);
            colorButton.set_rgba(color);
            this._colorRoles.set(roleId, assignedColor);
            this._updateColorButtonStyle(colorButton, assignedColor);
        });
    }

    _createColorAssignments() {
        return {
            'background': this._palette[0],
            'foreground': this._palette[15],
            'color0': this._palette[0],
            'color1': this._palette[1],
            'color2': this._palette[2],
            'color3': this._palette[3],
            'color4': this._palette[4],
            'color5': this._palette[5],
            'color6': this._palette[6],
            'color7': this._palette[7],
            'color8': this._palette[8],
            'color9': this._palette[9],
            'color10': this._palette[10],
            'color11': this._palette[11],
            'color12': this._palette[12],
            'color13': this._palette[13],
            'color14': this._palette[14],
            'color15': this._palette[15],
        };
    }

    loadColors(colorRoles) {
        forEachChild(this._listBox, (childRow) => {
            const roleId = childRow._roleId;
            const colorButton = childRow._colorButton;
            const savedColor = colorRoles[roleId];

            if (!savedColor) return;

            const color = new Gdk.RGBA();
            color.parse(savedColor);
            colorButton.set_rgba(color);
            this._colorRoles.set(roleId, savedColor);
            this._updateColorButtonStyle(colorButton, savedColor);
        });
    }

    _initializeDefaults() {
        Object.entries(DEFAULT_COLORS).forEach(([roleId, color]) => {
            this._colorRoles.set(roleId, color);
        });
    }

    getColors() {
        return Object.fromEntries(this._colorRoles);
    }

    reset() {
        this._palette = [];
        this._colorRoles.clear();
        this._initializeDefaults();

        // Reset all color buttons to default colors
        forEachChild(this._listBox, (childRow) => {
            const roleId = childRow._roleId;
            const colorButton = childRow._colorButton;
            const defaultColor = DEFAULT_COLORS[roleId];

            if (defaultColor) {
                const color = new Gdk.RGBA();
                color.parse(defaultColor);
                colorButton.set_rgba(color);
                this._updateColorButtonStyle(colorButton, defaultColor);
            }
        });
    }

    get widget() {
        return this;
    }
});
