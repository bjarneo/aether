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

        // Parse current color
        const rgba = new Gdk.RGBA();
        const parsed = rgba.parse(hexColor);

        if (!parsed) {
            console.error(`Failed to parse color: ${hexColor}`);
            return;
        }

        console.log(`Opening color picker for index ${index}: ${hexColor} -> RGBA(${rgba.red}, ${rgba.green}, ${rgba.blue})`);

        // Create custom dialog with ColorChooserWidget
        const dialog = new Gtk.Dialog({
            title: `Edit ${this.getAnsiColorName(index)}`,
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

        // Set current color
        colorChooser.set_rgba(rgba);

        // Add palette colors
        const paletteColors = this._palette.map(color => {
            const c = new Gdk.RGBA();
            c.parse(color.startsWith('#') ? color : '#' + color);
            return c;
        });

        colorChooser.add_palette(Gtk.Orientation.HORIZONTAL, 8, paletteColors);

        // Add to dialog content
        const contentArea = dialog.get_content_area();
        contentArea.append(colorChooser);

        // Handle response
        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
                const newRgba = colorChooser.get_rgba();
                const newHex = this.rgbaToHex(newRgba);

                // Update palette
                this._palette[index] = newHex;

                // Update visual color box
                const cssProvider = new Gtk.CssProvider();
                cssProvider.load_from_string(`
                    .color-swatch {
                        background-color: ${newHex};
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

            dialog.close();
        });

        dialog.present();
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
