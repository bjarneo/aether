import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

export const PaletteGenerator = GObject.registerClass({
    Signals: {
        'palette-generated': { param_types: [GObject.TYPE_JSOBJECT] },
    },
}, class PaletteGenerator extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
        });

        this._palette = [];
        this._currentWallpaper = null;

        // Wallpaper selection row
        const wallpaperRow = new Adw.ActionRow({
            title: 'Wallpaper',
            subtitle: 'Drop or select an image to extract colors',
        });

        const selectButton = new Gtk.Button({
            icon_name: 'document-open-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Select wallpaper',
        });
        selectButton.connect('clicked', () => this.selectWallpaper());
        wallpaperRow.add_suffix(selectButton);

        // Preview and palette display
        this._previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            height_request: 120,
        });

        this._wallpaperPreview = new Gtk.Picture({
            width_request: 140,
            height_request: 90,
            can_shrink: true,
            css_classes: ['card'],
        });

        this._paletteFlow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 6,
            row_spacing: 6,
            homogeneous: true,
            max_children_per_line: 8,
            min_children_per_line: 8,
            hexpand: true,
            vexpand: true,
        });

        this._previewBox.append(this._wallpaperPreview);
        this._previewBox.append(this._paletteFlow);

        // Spinner for loading state
        this._spinner = new Gtk.Spinner({
            margin_top: 12,
            margin_bottom: 12,
            width_request: 32,
            height_request: 32,
            halign: Gtk.Align.CENTER,
            visible: false,
        });

        this.append(wallpaperRow);
        this.append(this._spinner);
        this.append(this._previewBox);

        // Setup drop target for wallpaper
        this.setupDropTarget(wallpaperRow);
    }

    setupDropTarget(widget) {
        const dropTarget = Gtk.DropTarget.new(Gio.File.$gtype, Gdk.DragAction.COPY);

        dropTarget.connect('drop', (target, value) => {
            if (value instanceof Gio.File) {
                this.loadWallpaper(value.get_path());
                return true;
            }
            return false;
        });

        widget.add_controller(dropTarget);
    }

    selectWallpaper() {
        const dialog = new Gtk.FileDialog({
            title: 'Select Wallpaper',
        });

        const filter = new Gtk.FileFilter();
        filter.add_mime_type('image/png');
        filter.add_mime_type('image/jpeg');
        filter.add_mime_type('image/webp');
        filter.set_name('Images');

        const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
        filterList.append(filter);
        dialog.set_filters(filterList);

        dialog.open(this.get_root(), null, (source, result) => {
            try {
                const file = dialog.open_finish(result);
                if (file) {
                    this.loadWallpaper(file.get_path());
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('Error selecting file:', e.message);
                }
            }
        });
    }

    loadWallpaper(path) {
        try {
            this._currentWallpaper = path;

            // Load preview
            const file = Gio.File.new_for_path(path);
            this._wallpaperPreview.set_file(file);

            // Extract colors
            this.extractColors(path);
        } catch (e) {
            console.error('Error loading wallpaper:', e.message);
        }
    }

    extractColors(imagePath) {
        try {
            // Show spinner
            this._spinner.set_visible(true);
            this._spinner.start();

            // Use pywal to generate color palette
            const argv = ['wal', '-n', '-s', '-t', '-e', '-i', imagePath];
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.wait_async(null, (source, result) => {
                try {
                    const success = source.wait_finish(result);
                    const exitCode = source.get_exit_status();

                    if (!success || exitCode !== 0) {
                        const stderr = source.get_stderr_pipe();
                        if (stderr) {
                            const stream = new Gio.DataInputStream({ base_stream: stderr });
                            const [line] = stream.read_line_utf8(null);
                            console.error('Error running wal:', line);
                        }
                        this._spinner.stop();
                        this._spinner.set_visible(false);
                        return;
                    }

                    // Read generated colors from ~/.cache/wal/colors
                    const colors = this.readWalColors();
                    if (colors && colors.length === 16) {
                        this.setPalette(colors);
                        this.emit('palette-generated', colors);
                    } else {
                        console.error('Failed to read colors from wal cache');
                    }

                    // Hide spinner
                    this._spinner.stop();
                    this._spinner.set_visible(false);
                } catch (e) {
                    console.error('Error in wal callback:', e.message);
                    this._spinner.stop();
                    this._spinner.set_visible(false);
                }
            });
        } catch (e) {
            console.error('Error extracting colors:', e.message);
            this._spinner.stop();
            this._spinner.set_visible(false);
        }
    }

    readWalColors() {
        try {
            const homeDir = GLib.get_home_dir();
            const colorsPath = GLib.build_filenamev([homeDir, '.cache', 'wal', 'colors']);

            const file = Gio.File.new_for_path(colorsPath);
            const [success, contents] = file.load_contents(null);

            if (!success) {
                throw new Error(`Could not read file: ${colorsPath}`);
            }

            const decoder = new TextDecoder();
            const text = decoder.decode(contents);

            // Parse colors (one per line), ensure they have # prefix
            const colors = text.trim().split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const trimmed = line.trim();
                    return trimmed.startsWith('#') ? trimmed : '#' + trimmed;
                });

            console.log('Loaded colors from wal:', colors);
            return colors;
        } catch (e) {
            console.error('Error reading wal colors:', e.message);
            return null;
        }
    }



    setPalette(colors) {
        this._palette = colors;

        // Clear existing palette
        let child = this._paletteFlow.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._paletteFlow.remove(child);
            child = next;
        }

        // Add new colors (16 ANSI colors)
        colors.forEach((color, index) => {
            const colorBox = new Gtk.Box({
                width_request: 50,
                height_request: 50,
                css_classes: ['color-swatch'],
                tooltip_text: this.getAnsiColorName(index),
            });

            const cssProvider = new Gtk.CssProvider();
            cssProvider.load_from_string(`
                .color-swatch {
                    background-color: ${color};
                    border-radius: 8px;
                    border: 2px solid alpha(@borders, 0.5);
                    min-width: 50px;
                    min-height: 50px;
                }
                .color-swatch:hover {
                    border: 2px solid alpha(@borders, 1.0);
                }
            `);

            colorBox.get_style_context().add_provider(
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );

            // Set pointer cursor
            colorBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

            // Make color box clickable
            const gesture = new Gtk.GestureClick();
            gesture.connect('pressed', () => {
                // Get current color from palette (not the closure variable)
                this.openColorPicker(index, this._palette[index], colorBox);
            });
            colorBox.add_controller(gesture);

            this._paletteFlow.append(colorBox);
        });
    }

    openColorPicker(index, currentColor, colorBox) {
        // Ensure color has # prefix
        let hexColor = currentColor;
        if (!hexColor.startsWith('#')) {
            hexColor = '#' + hexColor;
        }

        console.log(`Opening shade picker for index ${index}: ${hexColor}`);

        // Create shade picker dialog
        const dialog = new Gtk.Dialog({
            title: `Select Shade - ${this.getAnsiColorName(index)}`,
            modal: true,
            transient_for: this.get_root(),
            use_header_bar: true,
        });

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);

        // Generate shades
        const shades = this.generateShades(hexColor, 15);

        // Create container for shades
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        // Add shades flow box
        const shadesFlow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 6,
            row_spacing: 6,
            homogeneous: true,
            max_children_per_line: 5,
            min_children_per_line: 5,
        });

        shades.forEach(shade => {
            const shadeBox = new Gtk.Box({
                width_request: 50,
                height_request: 50,
                css_classes: ['color-swatch'],
                tooltip_text: shade,
            });

            const cssProvider = new Gtk.CssProvider();
            cssProvider.load_from_string(`
                .color-swatch {
                    background-color: ${shade};
                    border-radius: 8px;
                    border: 2px solid alpha(@borders, 0.5);
                }
                .color-swatch:hover {
                    border: 2px solid alpha(@borders, 1.0);
                    transform: scale(1.05);
                }
            `);

            shadeBox.get_style_context().add_provider(
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );

            shadeBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

            const gesture = new Gtk.GestureClick();
            gesture.connect('pressed', () => {
                this.applyColorToSwatch(index, shade, colorBox);
                dialog.close();
            });
            shadeBox.add_controller(gesture);

            shadesFlow.append(shadeBox);
        });

        contentBox.append(shadesFlow);

        // Add + button to open full color picker
        const pickerButton = new Gtk.Button({
            label: '+ Custom Color',
            css_classes: ['suggested-action'],
            margin_top: 6,
        });

        pickerButton.connect('clicked', () => {
            dialog.close();
            this.openFullColorPicker(index, hexColor, colorBox);
        });

        contentBox.append(pickerButton);

        const contentArea = dialog.get_content_area();
        contentArea.append(contentBox);

        dialog.present();
    }

    openFullColorPicker(index, currentColor, colorBox) {
        // Parse current color
        const rgba = new Gdk.RGBA();
        const parsed = rgba.parse(currentColor);

        if (!parsed) {
            console.error(`Failed to parse color: ${currentColor}`);
            return;
        }

        // Create custom dialog with ColorChooserWidget
        const dialog = new Gtk.Dialog({
            title: `Custom Color - ${this.getAnsiColorName(index)}`,
            modal: true,
            transient_for: this.get_root(),
            use_header_bar: true,
        });

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button('Select', Gtk.ResponseType.OK);

        // Create color chooser widget
        const colorChooser = new Gtk.ColorChooserWidget({
            show_editor: true,
            use_alpha: false,
        });

        colorChooser.set_rgba(rgba);

        // Add palette colors
        const paletteColors = this._palette.map(color => {
            const c = new Gdk.RGBA();
            c.parse(color.startsWith('#') ? color : '#' + color);
            return c;
        });

        colorChooser.add_palette(Gtk.Orientation.HORIZONTAL, 8, paletteColors);

        const contentArea = dialog.get_content_area();
        contentArea.append(colorChooser);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
                const newRgba = colorChooser.get_rgba();
                const newHex = this.rgbaToHex(newRgba);
                this.applyColorToSwatch(index, newHex, colorBox);
            }
            dialog.close();
        });

        dialog.present();
    }

    generateShades(hexColor, count) {
        // Convert hex to HSL
        const rgb = this.hexToRgb(hexColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const shades = [];

        // Generate shades from dark to light
        for (let i = 0; i < count; i++) {
            const lightness = (i / (count - 1)) * 100; // 0% to 100%
            const shade = this.hslToHex(hsl.h, hsl.s, lightness);
            shades.push(shade);
        }

        return shades;
    }

    applyColorToSwatch(index, hexColor, colorBox) {
        // Update palette
        this._palette[index] = hexColor;

        // Update visual color box
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_string(`
            .color-swatch {
                background-color: ${hexColor};
                border-radius: 8px;
                border: 2px solid alpha(@borders, 0.5);
                min-width: 50px;
                min-height: 50px;
            }
            .color-swatch:hover {
                border: 2px solid alpha(@borders, 1.0);
            }
        `);

        colorBox.get_style_context().add_provider(
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // Emit signal to update color synthesizer
        this.emit('palette-generated', this._palette);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    hslToHex(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

    getAnsiColorName(index) {
        const names = [
            'Black (0)', 'Red (1)', 'Green (2)', 'Yellow (3)',
            'Blue (4)', 'Magenta (5)', 'Cyan (6)', 'White (7)',
            'Bright Black (8)', 'Bright Red (9)', 'Bright Green (10)', 'Bright Yellow (11)',
            'Bright Blue (12)', 'Bright Magenta (13)', 'Bright Cyan (14)', 'Bright White (15)'
        ];
        return names[index] || `Color ${index}`;
    }


    getPalette() {
        return {
            wallpaper: this._currentWallpaper,
            colors: this._palette,
        };
    }

    get widget() {
        return this;
    }
});
