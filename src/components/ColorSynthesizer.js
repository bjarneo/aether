import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

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

        // Define color roles matching template variables
        this._roles = [
            { id: 'background', label: 'Background', description: 'Primary background color' },
            { id: 'foreground', label: 'Foreground', description: 'Primary text color' },
            { id: 'color0', label: 'Black (0)', description: 'ANSI color 0' },
            { id: 'color1', label: 'Red (1)', description: 'ANSI color 1' },
            { id: 'color2', label: 'Green (2)', description: 'ANSI color 2' },
            { id: 'color3', label: 'Yellow (3)', description: 'ANSI color 3' },
            { id: 'color4', label: 'Blue (4)', description: 'ANSI color 4' },
            { id: 'color5', label: 'Magenta (5)', description: 'ANSI color 5' },
            { id: 'color6', label: 'Cyan (6)', description: 'ANSI color 6' },
            { id: 'color7', label: 'White (7)', description: 'ANSI color 7' },
            { id: 'color8', label: 'Bright Black (8)', description: 'ANSI color 8' },
            { id: 'color9', label: 'Bright Red (9)', description: 'ANSI color 9' },
            { id: 'color10', label: 'Bright Green (10)', description: 'ANSI color 10' },
            { id: 'color11', label: 'Bright Yellow (11)', description: 'ANSI color 11' },
            { id: 'color12', label: 'Bright Blue (12)', description: 'ANSI color 12' },
            { id: 'color13', label: 'Bright Magenta (13)', description: 'ANSI color 13' },
            { id: 'color14', label: 'Bright Cyan (14)', description: 'ANSI color 14' },
            { id: 'color15', label: 'Bright White (15)', description: 'ANSI color 15' },
        ];

        // Create a list box for color roles
        this._listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });

        this._roles.forEach(role => {
            const row = this.createColorRoleRow(role);
            this._listBox.append(row);
        });

        this.append(this._listBox);

        // Set some intelligent defaults
        this.initializeDefaults();
    }

    createColorRoleRow(role) {
        const row = new Adw.ActionRow({
            title: role.label,
            subtitle: role.description,
        });

        // Color preview button
        const colorButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose color',
        });

        const colorDialog = new Gtk.ColorDialog({
            with_alpha: true,
        });
        colorButton.set_dialog(colorDialog);

        // Store initial color
        const initialColor = new Gdk.RGBA();
        initialColor.parse('#808080');
        colorButton.set_rgba(initialColor);

        // Connect to color changes
        colorButton.connect('notify::rgba', () => {
            const rgba = colorButton.get_rgba();
            const hex = this.rgbaToHex(rgba);
            this._colorRoles.set(role.id, hex);
            this.emit('color-changed', role.id, hex);

            // Update button style to show color
            this.updateColorButtonStyle(colorButton, hex);
        });

        row.add_suffix(colorButton);

        // Store reference for later updates
        row._colorButton = colorButton;
        row._roleId = role.id;

        return row;
    }

    updateColorButtonStyle(button, hexColor) {
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_string(`
            .color-button-custom {
                background-color: ${hexColor};
                min-width: 48px;
                min-height: 32px;
                border-radius: 6px;
            }
        `);

        button.get_style_context().add_provider(
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    setPalette(colors) {
        this._palette = colors;
        this.autoAssignColors();
    }

    autoAssignColors() {
        if (this._palette.length < 16) return;

        // Map colors from palette (16 colors from pywal in order: 0-15)
        const assignments = {
            'background': this._palette[0],   // color0 - Black
            'foreground': this._palette[15],  // color15 - Bright White
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

        let childRow = this._listBox.get_first_child();
        while (childRow) {
            const roleId = childRow._roleId;
            const colorButton = childRow._colorButton;

            if (assignments[roleId]) {
                const color = new Gdk.RGBA();
                color.parse(assignments[roleId]);
                colorButton.set_rgba(color);

                this._colorRoles.set(roleId, assignments[roleId]);
                this.updateColorButtonStyle(colorButton, assignments[roleId]);
            }

            childRow = childRow.get_next_sibling();
        }
    }

    loadColors(colorRoles) {
        // Load saved color assignments
        let childRow = this._listBox.get_first_child();
        while (childRow) {
            const roleId = childRow._roleId;
            const colorButton = childRow._colorButton;

            if (colorRoles[roleId]) {
                const color = new Gdk.RGBA();
                color.parse(colorRoles[roleId]);
                colorButton.set_rgba(color);

                this._colorRoles.set(roleId, colorRoles[roleId]);
                this.updateColorButtonStyle(colorButton, colorRoles[roleId]);
            }

            childRow = childRow.get_next_sibling();
        }
    }

    initializeDefaults() {
        const defaults = {
            'background': '#1e1e2e',
            'foreground': '#cdd6f4',
            'color0': '#45475a',
            'color1': '#f38ba8',
            'color2': '#a6e3a1',
            'color3': '#f9e2af',
            'color4': '#89b4fa',
            'color5': '#cba6f7',
            'color6': '#94e2d5',
            'color7': '#bac2de',
            'color8': '#585b70',
            'color9': '#f38ba8',
            'color10': '#a6e3a1',
            'color11': '#f9e2af',
            'color12': '#89b4fa',
            'color13': '#cba6f7',
            'color14': '#94e2d5',
            'color15': '#cdd6f4',
        };

        Object.entries(defaults).forEach(([roleId, color]) => {
            this._colorRoles.set(roleId, color);
        });
    }

    rgbaToHex(rgba) {
        const r = Math.round(rgba.red * 255);
        const g = Math.round(rgba.green * 255);
        const b = Math.round(rgba.blue * 255);

        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    getColors() {
        return Object.fromEntries(this._colorRoles);
    }

    get widget() {
        return this;
    }
});
