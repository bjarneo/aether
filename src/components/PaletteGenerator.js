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
        this._originalPalette = []; // Store original colors from pywal for adjustments
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

        // Color harmony generation row
        const harmonyRow = new Adw.ActionRow({
            title: 'Color Harmony',
            subtitle: 'Generate color schemes from a base color',
        });

        const harmonyBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            valign: Gtk.Align.CENTER,
        });

        // Color picker for base color
        this._baseColorButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose base color',
        });

        const baseColorDialog = new Gtk.ColorDialog({
            with_alpha: false,
        });
        this._baseColorButton.set_dialog(baseColorDialog);

        // Set initial color
        const initialColor = new Gdk.RGBA();
        initialColor.parse('#4a86e8');
        this._baseColorButton.set_rgba(initialColor);

        // Harmony type dropdown
        const harmonyTypes = new Gtk.StringList();
        harmonyTypes.append('Analogous');
        harmonyTypes.append('Monochromatic');
        harmonyTypes.append('Complementary');
        harmonyTypes.append('Split Complementary');
        harmonyTypes.append('Shades');
        harmonyTypes.append('Squares');

        this._harmonyDropdown = new Gtk.DropDown({
            model: harmonyTypes,
            valign: Gtk.Align.CENTER,
        });

        // Generate button
        const generateButton = new Gtk.Button({
            label: 'Generate',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        generateButton.connect('clicked', () => this.generateHarmony());

        harmonyBox.append(this._baseColorButton);
        harmonyBox.append(this._harmonyDropdown);
        harmonyBox.append(generateButton);

        harmonyRow.add_suffix(harmonyBox);

        // Preview and palette display
        this._previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 6,
            margin_bottom: 6,
        });

        this._wallpaperPreview = new Gtk.Picture({
            height_request: 200,
            can_shrink: true,
            css_classes: ['card'],
            hexpand: true,
        });

        this._paletteFlow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 4,
            row_spacing: 4,
            homogeneous: true,
            max_children_per_line: 8,
            min_children_per_line: 8,
            hexpand: true,
        });

        this._previewBox.append(this._wallpaperPreview);
        this._previewBox.append(this._paletteFlow);

        // Color adjustment controls (initially hidden)
        this._adjustmentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_top: 4,
            margin_bottom: 4,
            visible: false,
        });

        // Vibrance slider
        const vibranceBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 6,
            margin_end: 6,
            margin_top: 2,
            margin_bottom: 2,
        });
        const vibranceLabel = new Gtk.Label({
            label: 'Vibrance',
            width_chars: 12,
            xalign: 0,
        });
        this._vibranceScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: -50,
                upper: 50,
                value: 0,
                step_increment: 5,
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
        });
        this._vibranceScale.connect('value-changed', () => this.applyAdjustments());
        vibranceBox.append(vibranceLabel);
        vibranceBox.append(this._vibranceScale);

        // Contrast slider
        const contrastBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 6,
            margin_end: 6,
            margin_top: 2,
            margin_bottom: 2,
        });
        const contrastLabel = new Gtk.Label({
            label: 'Contrast',
            width_chars: 12,
            xalign: 0,
        });
        this._contrastScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: -30,
                upper: 30,
                value: 0,
                step_increment: 5,
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
        });
        this._contrastScale.connect('value-changed', () => this.applyAdjustments());
        contrastBox.append(contrastLabel);
        contrastBox.append(this._contrastScale);

        // Brightness slider
        const brightnessBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 6,
            margin_end: 6,
            margin_top: 2,
            margin_bottom: 2,
        });
        const brightnessLabel = new Gtk.Label({
            label: 'Brightness',
            width_chars: 12,
            xalign: 0,
        });
        this._brightnessScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: -30,
                upper: 30,
                value: 0,
                step_increment: 5,
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
        });
        this._brightnessScale.connect('value-changed', () => this.applyAdjustments());
        brightnessBox.append(brightnessLabel);
        brightnessBox.append(this._brightnessScale);

        // Hue shift slider
        const hueBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 6,
            margin_end: 6,
            margin_top: 2,
            margin_bottom: 2,
        });
        const hueLabel = new Gtk.Label({
            label: 'Hue Shift',
            width_chars: 12,
            xalign: 0,
        });
        this._hueScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: -180,
                upper: 180,
                value: 0,
                step_increment: 10,
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
        });
        this._hueScale.connect('value-changed', () => this.applyAdjustments());
        hueBox.append(hueLabel);
        hueBox.append(this._hueScale);

        // Reset button
        const resetButton = new Gtk.Button({
            label: 'Reset',
            halign: Gtk.Align.CENTER,
            margin_top: 4,
        });
        resetButton.connect('clicked', () => this.resetAdjustments());

        this._adjustmentBox.append(vibranceBox);
        this._adjustmentBox.append(contrastBox);
        this._adjustmentBox.append(brightnessBox);
        this._adjustmentBox.append(hueBox);
        this._adjustmentBox.append(resetButton);

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
        this.append(harmonyRow);
        this.append(this._spinner);
        this.append(this._previewBox);
        this.append(this._adjustmentBox);

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
                        this._originalPalette = [...colors]; // Store original for adjustments
                        this.setPalette(colors);
                        this.emit('palette-generated', colors);

                        // Show adjustment controls
                        this._adjustmentBox.set_visible(true);
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

    generateHarmony() {
        // Get base color
        const rgba = this._baseColorButton.get_rgba();
        const baseColor = this.rgbaToHex(rgba);

        // Get harmony type
        const harmonyType = this._harmonyDropdown.get_selected();

        const harmonyNames = ['analogous', 'monochromatic', 'complementary', 'split complementary', 'shades', 'squares'];
        console.log(`Generating ${harmonyNames[harmonyType]} harmony from ${baseColor}`);

        let colors = [];

        switch (harmonyType) {
            case 0: // Analogous
                colors = this.generateAnalogous(baseColor);
                break;
            case 1: // Monochromatic
                colors = this.generateMonochromatic(baseColor);
                break;
            case 2: // Complementary
                colors = this.generateComplementary(baseColor);
                break;
            case 3: // Split Complementary
                colors = this.generateSplitComplementary(baseColor);
                break;
            case 4: // Shades
                colors = this.generateShades(baseColor, 16);
                break;
            case 5: // Squares
                colors = this.generateSquares(baseColor);
                break;
        }

        // Update palette
        this.setPalette(colors);
        this.emit('palette-generated', colors);
    }

    generateAnalogous(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colors = [];

        // ANSI order: Black, Red, Green, Yellow, Blue, Magenta, Cyan, White
        // Generate analogous colors spread around base hue
        const hueOffsets = [-30, -20, -10, 0, 10, 20, 30, 15]; // Analogous spread

        // Color 0: Dark background
        colors[0] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

        // Colors 1-7: Normal ANSI colors with analogous hues
        for (let i = 1; i < 8; i++) {
            const hue = (hsl.h + hueOffsets[i - 1] + 360) % 360;
            const saturation = Math.max(50, hsl.s * 0.9);
            const lightness = i === 7 ? 75 : 55; // White is lighter
            colors[i] = this.hslToHex(hue, saturation, lightness);
        }

        // Color 8: Brighter background (for comments/secondary)
        colors[8] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

        // Colors 9-15: Bright versions of 1-7
        for (let i = 9; i < 16; i++) {
            colors[i] = this.brightenColor(colors[i - 8], 20);
        }

        return colors;
    }

    generateMonochromatic(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colors = [];

        // Color 0: Dark background
        colors[0] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

        // Colors 1-7: Progressive lightness, same hue
        const baseLightness = [50, 55, 60, 65, 70, 75, 80];
        for (let i = 1; i < 8; i++) {
            const saturation = hsl.s * 0.85;
            colors[i] = this.hslToHex(hsl.h, saturation, baseLightness[i - 1]);
        }

        // Color 8: Brighter background
        colors[8] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

        // Colors 9-15: Bright versions
        for (let i = 9; i < 16; i++) {
            colors[i] = this.brightenColor(colors[i - 8], 20);
        }

        return colors;
    }

    generateComplementary(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colors = [];
        const complementHue = (hsl.h + 180) % 360;

        // Color 0: Dark background using base hue
        colors[0] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

        // Colors 1-7: Alternate between base and complement
        const hues = [hsl.h, complementHue, hsl.h, complementHue, hsl.h, complementHue, hsl.h];
        for (let i = 1; i < 8; i++) {
            const saturation = Math.max(50, hsl.s * 0.85);
            const lightness = i === 7 ? 75 : 55;
            colors[i] = this.hslToHex(hues[i - 1], saturation, lightness);
        }

        // Color 8: Brighter background
        colors[8] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

        // Colors 9-15: Bright versions
        for (let i = 9; i < 16; i++) {
            colors[i] = this.brightenColor(colors[i - 8], 20);
        }

        return colors;
    }

    generateSplitComplementary(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colors = [];
        const complement1 = (hsl.h + 150) % 360; // 30° before complement
        const complement2 = (hsl.h + 210) % 360; // 30° after complement

        // Color 0: Dark background
        colors[0] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

        // Colors 1-7: Rotate through base and split complements
        const hues = [hsl.h, complement1, complement2, hsl.h, complement1, complement2, hsl.h];
        for (let i = 1; i < 8; i++) {
            const saturation = Math.max(50, hsl.s * 0.85);
            const lightness = i === 7 ? 75 : 55;
            colors[i] = this.hslToHex(hues[i - 1], saturation, lightness);
        }

        // Color 8: Brighter background
        colors[8] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

        // Colors 9-15: Bright versions
        for (let i = 9; i < 16; i++) {
            colors[i] = this.brightenColor(colors[i - 8], 20);
        }

        return colors;
    }

    generateSquares(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colors = [];
        const squareHues = [
            hsl.h,
            (hsl.h + 90) % 360,
            (hsl.h + 180) % 360,
            (hsl.h + 270) % 360
        ];

        // Color 0: Dark background
        colors[0] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

        // Colors 1-7: Rotate through 4 square hues
        for (let i = 1; i < 8; i++) {
            const hue = squareHues[(i - 1) % 4];
            const saturation = Math.max(50, hsl.s * 0.85);
            const lightness = i === 7 ? 75 : 55;
            colors[i] = this.hslToHex(hue, saturation, lightness);
        }

        // Color 8: Brighter background
        colors[8] = this.hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

        // Colors 9-15: Bright versions
        for (let i = 9; i < 16; i++) {
            colors[i] = this.brightenColor(colors[i - 8], 20);
        }

        return colors;
    }

    applyAdjustments() {
        if (this._originalPalette.length === 0) return;

        const vibrance = this._vibranceScale.get_value();
        const contrast = this._contrastScale.get_value();
        const brightness = this._brightnessScale.get_value();
        const hueShift = this._hueScale.get_value();

        const adjustedColors = this._originalPalette.map(color => {
            return this.adjustColor(color, vibrance, contrast, brightness, hueShift);
        });

        this.setPalette(adjustedColors);
        this.emit('palette-generated', adjustedColors);
    }

    adjustColor(hexColor, vibrance, contrast, brightness, hueShift) {
        const rgb = this.hexToRgb(hexColor);
        let hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Apply hue shift
        hsl.h = (hsl.h + hueShift + 360) % 360;

        // Apply vibrance (saturation adjustment)
        hsl.s = Math.max(0, Math.min(100, hsl.s + vibrance));

        // Apply brightness
        hsl.l = Math.max(0, Math.min(100, hsl.l + brightness));

        // Apply contrast (expand or compress around 50% lightness)
        const contrastFactor = contrast / 100;
        const deviation = hsl.l - 50;
        hsl.l = 50 + deviation * (1 + contrastFactor);
        hsl.l = Math.max(0, Math.min(100, hsl.l));

        return this.hslToHex(hsl.h, hsl.s, hsl.l);
    }

    resetAdjustments() {
        this._vibranceScale.set_value(0);
        this._contrastScale.set_value(0);
        this._brightnessScale.set_value(0);
        this._hueScale.set_value(0);

        if (this._originalPalette.length > 0) {
            this.setPalette([...this._originalPalette]);
            this.emit('palette-generated', this._originalPalette);
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
            let colors = text.trim().split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const trimmed = line.trim();
                    return trimmed.startsWith('#') ? trimmed : '#' + trimmed;
                });

            // Make colors 9-15 brighter versions of colors 1-7 (skip color 8)
            if (colors.length >= 16) {
                colors = colors.map((color, index) => {
                    if (index >= 9 && index <= 15) {
                        // Bright variant: brighten the corresponding base color (index - 8)
                        return this.brightenColor(colors[index - 8], 20);
                    }
                    return color;
                });
            }

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
                width_request: 35,
                height_request: 35,
                css_classes: ['color-swatch'],
                tooltip_text: this.getAnsiColorName(index),
            });

            const cssProvider = new Gtk.CssProvider();
            cssProvider.load_from_string(`
                .color-swatch {
                    background-color: ${color};
                    border-radius: 6px;
                    border: 1px solid alpha(@borders, 0.5);
                    min-width: 35px;
                    min-height: 35px;
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

        // Find closest shade to current color
        const closestShadeIndex = this.findClosestShade(hexColor, shades);

        // Create container for shades
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
        });

        // Add shades flow box
        const shadesFlow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 4,
            row_spacing: 4,
            homogeneous: true,
            max_children_per_line: 5,
            min_children_per_line: 5,
        });

        shades.forEach((shade, shadeIndex) => {
            const isActive = shadeIndex === closestShadeIndex;

            const shadeBox = new Gtk.Box({
                width_request: 40,
                height_request: 40,
                css_classes: ['color-swatch'],
                tooltip_text: shade + (isActive ? ' (current)' : ''),
            });

            const cssProvider = new Gtk.CssProvider();
            const borderStyle = isActive
                ? 'border: 2px solid @accent_color;'
                : 'border: 1px solid alpha(@borders, 0.5);';

            cssProvider.load_from_string(`
                .color-swatch {
                    background-color: ${shade};
                    border-radius: 6px;
                    ${borderStyle}
                }
                .color-swatch:hover {
                    border: 2px solid @accent_color;
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
            margin_top: 4,
        });

        pickerButton.connect('clicked', () => {
            dialog.close();
            this.openFullColorPicker(index, hexColor, colorBox);
        });

        contentBox.append(pickerButton);

        const contentArea = dialog.get_content_area();
        contentArea.append(contentBox);

        // Handle dialog response (Cancel button)
        dialog.connect('response', (dlg, response) => {
            dialog.close();
        });

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

    findClosestShade(currentColor, shades) {
        // Convert current color to RGB
        const currentRgb = this.hexToRgb(currentColor);

        let closestIndex = 0;
        let minDistance = Infinity;

        shades.forEach((shade, index) => {
            const shadeRgb = this.hexToRgb(shade);

            // Calculate Euclidean distance in RGB space
            const distance = Math.sqrt(
                Math.pow(currentRgb.r - shadeRgb.r, 2) +
                Math.pow(currentRgb.g - shadeRgb.g, 2) +
                Math.pow(currentRgb.b - shadeRgb.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex;
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

    brightenColor(hexColor, amount = 20) {
        // Convert hex to RGB
        const rgb = this.hexToRgb(hexColor);

        // Convert to HSL
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Increase lightness
        const newLightness = Math.min(100, hsl.l + amount);

        // Convert back to hex
        return this.hslToHex(hsl.h, hsl.s, newLightness);
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
