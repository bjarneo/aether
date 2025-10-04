import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { extractColorsFromWallpaper } from '../services/wallpaper-service.js';
import { generateHarmony } from '../services/color-harmony.js';
import { rgbaToHex, adjustColor } from '../utils/color-utils.js';
import { applyCssToWidget } from '../utils/ui-helpers.js';
import { HARMONY_TYPES } from '../constants/colors.js';
import { ColorSwatchGrid } from './palette/color-swatch-grid.js';
import { ColorAdjustmentControls } from './palette/color-adjustment-controls.js';
import { ColorPickerDialog } from './palette/color-picker-dialog.js';

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
        this._originalPalette = [];
        this._currentWallpaper = null;

        this._initializeUI();
    }

    _initializeUI() {
        // Wallpaper selection row
        this.append(this._createWallpaperRow());

        // Color harmony generation row
        // this.append(this._createHarmonyRow());

        // Loading spinner
        this._spinner = new Gtk.Spinner({
            margin_top: 12,
            margin_bottom: 12,
            width_request: 32,
            height_request: 32,
            halign: Gtk.Align.CENTER,
            visible: false,
        });
        this.append(this._spinner);

        // Preview container
        const previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 6,
            margin_bottom: 6,
        });

        // Wallpaper preview
        this._wallpaperPreview = new Gtk.Picture({
            height_request: 200,
            can_shrink: true,
            css_classes: ['card'],
            hexpand: true,
        });
        previewBox.append(this._wallpaperPreview);

        // Color swatch grid
        this._swatchGrid = new ColorSwatchGrid((index, color, swatch) => {
            this._openColorPicker(index, color, swatch);
        });
        previewBox.append(this._swatchGrid.widget);

        this.append(previewBox);

        // Color adjustment controls
        this._adjustmentControls = new ColorAdjustmentControls(
            (values) => this._applyAdjustments(values),
            () => this._resetAdjustments()
        );
        this.append(this._adjustmentControls.widget);
    }

    _createWallpaperRow() {
        const row = new Adw.ActionRow({
            title: 'Wallpaper',
            subtitle: 'Drop or select an image to extract colors',
        });

        const selectButton = new Gtk.Button({
            icon_name: 'document-open-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Select wallpaper',
        });
        selectButton.connect('clicked', () => this._selectWallpaper());
        row.add_suffix(selectButton);

        this._setupDropTarget(row);

        return row;
    }

    _createHarmonyRow() {
        const row = new Adw.ActionRow({
            title: 'Color Harmony',
            subtitle: 'Generate color schemes from a base color',
        });

        const harmonyBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            valign: Gtk.Align.CENTER,
        });

        // Base color button
        this._baseColorButton = new Gtk.ColorDialogButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Choose base color',
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
        });

        const initialColor = new Gdk.RGBA();
        initialColor.parse('#4a86e8');
        this._baseColorButton.set_rgba(initialColor);

        // Harmony type dropdown
        const harmonyTypes = new Gtk.StringList();
        HARMONY_TYPES.forEach(type => harmonyTypes.append(type));

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
        generateButton.connect('clicked', () => this._generateHarmony());

        harmonyBox.append(this._baseColorButton);
        harmonyBox.append(this._harmonyDropdown);
        harmonyBox.append(generateButton);

        row.add_suffix(harmonyBox);

        return row;
    }

    _setupDropTarget(widget) {
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

    _selectWallpaper() {
        const dialog = new Gtk.FileDialog({ title: 'Select Wallpaper' });

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
        this._currentWallpaper = path;

        const file = Gio.File.new_for_path(path);
        this._wallpaperPreview.set_file(file);

        this._extractColors(path);
    }

    _extractColors(imagePath) {
        this._showLoading(true);

        extractColorsFromWallpaper(
            imagePath,
            (colors) => {
                this._originalPalette = [...colors];
                this.setPalette(colors);
                this.emit('palette-generated', colors);
                this._adjustmentControls.reset();
                this._adjustmentControls.show();
                this._showLoading(false);
            },
            (error) => {
                console.error('Error extracting colors:', error.message);
                this._showLoading(false);
            }
        );
    }

    _generateHarmony() {
        const rgba = this._baseColorButton.get_rgba();
        const baseColor = rgbaToHex(rgba);
        const harmonyType = this._harmonyDropdown.get_selected();

        console.log(`Generating ${HARMONY_TYPES[harmonyType]} harmony from ${baseColor}`);

        const colors = generateHarmony(baseColor, harmonyType);
        this._originalPalette = [...colors];
        this.setPalette(colors);
        this.emit('palette-generated', colors);
    }

    _applyAdjustments(values) {
        if (this._originalPalette.length === 0) return;

        const adjustedColors = this._originalPalette.map(color => {
            return adjustColor(
                color,
                values.vibrance,
                values.contrast,
                values.brightness,
                values.hueShift,
                values.temperature,
                values.gamma
            );
        });

        this.setPalette(adjustedColors);
        this.emit('palette-generated', adjustedColors);
    }

    _resetAdjustments() {
        if (this._originalPalette.length > 0) {
            this.setPalette([...this._originalPalette]);
            this.emit('palette-generated', this._originalPalette);
        }
    }

    _openColorPicker(index, color, swatch) {
        const picker = new ColorPickerDialog(this.get_root(), this._palette);

        picker.openShadePicker(index, color, (newColor) => {
            this._applyColorToSwatch(index, newColor, swatch);
        });
    }

    _applyColorToSwatch(index, hexColor, colorBox) {
        this._palette[index] = hexColor;
        this._swatchGrid.updateSwatchColor(index, hexColor);

        const css = `
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
        `;

        applyCssToWidget(colorBox, css);
        this.emit('palette-generated', this._palette);
    }

    setPalette(colors) {
        this._palette = colors;
        this._swatchGrid.setPalette(colors);
    }

    resetAdjustments() {
        this._adjustmentControls.reset();
    }

    _showLoading(visible) {
        this._spinner.set_visible(visible);
        if (visible) {
            this._spinner.start();
        } else {
            this._spinner.stop();
        }
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
