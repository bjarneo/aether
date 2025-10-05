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
import { ColorPickerDialog } from './palette/color-picker-dialog.js';

export const PaletteGenerator = GObject.registerClass({
    Signals: {
        'palette-generated': { param_types: [GObject.TYPE_JSOBJECT] },
        'adjustments-applied': { param_types: [GObject.TYPE_JSOBJECT] },
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
        this._harmonyWallpaper = null;

        this._initializeUI();
    }

    _initializeUI() {
        // View stack for the two modes
        this._viewStack = new Adw.ViewStack();

        // Tab 1: Wallpaper Extraction
        const wallpaperView = this._createWallpaperView();
        const wallpaperPage = this._viewStack.add_titled(wallpaperView, 'wallpaper', 'From Wallpaper');
        wallpaperPage.set_icon_name('image-x-generic-symbolic');

        // Tab 2: Color Harmony
        const harmonyView = this._createHarmonyView();
        const harmonyPage = this._viewStack.add_titled(harmonyView, 'harmony', 'Color Harmony');
        harmonyPage.set_icon_name('applications-graphics-symbolic');

        // View switcher title for tabs at the top
        const viewSwitcherTitle = new Adw.ViewSwitcherTitle();
        viewSwitcherTitle.set_stack(this._viewStack);
        viewSwitcherTitle.set_title('Palette Source');

        this.append(viewSwitcherTitle);
        this.append(this._viewStack);

        // Shared preview container (used by both tabs)
        const previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 6,
            margin_bottom: 6,
        });

        // Color swatch grid
        this._swatchGrid = new ColorSwatchGrid((index, color, swatch) => {
            this._openColorPicker(index, color, swatch);
        });
        previewBox.append(this._swatchGrid.widget);

        this.append(previewBox);
    }

    _createWallpaperView() {
        const viewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
        });

        // Wallpaper selection row
        viewBox.append(this._createWallpaperRow());

        // Loading spinner
        this._spinner = new Gtk.Spinner({
            margin_top: 12,
            margin_bottom: 12,
            width_request: 32,
            height_request: 32,
            halign: Gtk.Align.CENTER,
            visible: false,
        });
        viewBox.append(this._spinner);

        // Wallpaper preview
        this._wallpaperPreview = new Gtk.Picture({
            height_request: 200,
            can_shrink: true,
            css_classes: ['card'],
            hexpand: true,
        });
        viewBox.append(this._wallpaperPreview);

        return viewBox;
    }

    _createHarmonyView() {
        const viewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
        });

        // Wallpaper for background
        const wallpaperReferenceRow = new Adw.ActionRow({
            title: 'Add Wallpaper',
            subtitle: 'Select wallpaper for background image',
        });

        const selectRefButton = new Gtk.Button({
            icon_name: 'document-open-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Select wallpaper',
        });
        selectRefButton.connect('clicked', () => this._selectHarmonyWallpaper());
        wallpaperReferenceRow.add_suffix(selectRefButton);

        viewBox.append(wallpaperReferenceRow);

        // Harmony wallpaper preview
        this._harmonyWallpaperPreview = new Gtk.Picture({
            height_request: 150,
            can_shrink: true,
            css_classes: ['card'],
            hexpand: true,
            visible: false,
        });
        viewBox.append(this._harmonyWallpaperPreview);

        // Color harmony controls
        viewBox.append(this._createHarmonyControls());

        return viewBox;
    }

    _createHarmonyControls() {
        const controlsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
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

        return controlsBox;
    }

    _createWallpaperRow() {
        const row = new Adw.ActionRow({
            title: 'Wallpaper',
            subtitle: 'Select an image to extract colors',
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

    _selectHarmonyWallpaper() {
        const dialog = new Gtk.FileDialog({ title: 'Select Wallpaper Reference' });

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
                    this._harmonyWallpaper = file.get_path();
                    this._harmonyWallpaperPreview.set_file(file);
                    this._harmonyWallpaperPreview.set_visible(true);
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('Error selecting file:', e.message);
                }
            }
        });
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
                this._showLoading(false);
            },
            (error) => {
                console.error('Error extracting colors:', error.message);
                this._showLoading(false);
            }
        );
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
            const css = `* { background-color: ${color}; border-radius: 6px; }`;
            applyCssToWidget(colorBox, css);
            this._harmonyPreviewBox.append(colorBox);
        });
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

    applyPreset(preset) {
        this._originalPalette = [...preset.colors];
        this.setPalette(preset.colors);
        this.emit('palette-generated', preset.colors);
        console.log(`Applied preset: ${preset.name}`);
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

    _showLoading(visible) {
        this._spinner.set_visible(visible);
        if (visible) {
            this._spinner.start();
        } else {
            this._spinner.stop();
        }
    }

    reset() {
        this._palette = [];
        this._originalPalette = [];
        this._currentWallpaper = null;
        this._harmonyWallpaper = null;
        this._wallpaperPreview.set_file(null);
        this._harmonyWallpaperPreview.set_visible(false);
        this._swatchGrid.setPalette([]);
        this._showLoading(false);
    }

    getPalette() {
        // Check which tab is active to determine which wallpaper to use
        const activeTab = this._viewStack.get_visible_child_name();
        let wallpaper = null;

        if (activeTab === 'wallpaper') {
            wallpaper = this._currentWallpaper;
        } else if (activeTab === 'harmony') {
            wallpaper = this._harmonyWallpaper;
        }
        // presets tab has no wallpaper by default

        return {
            wallpaper: wallpaper,
            colors: this._palette,
        };
    }

    get widget() {
        return this;
    }
});
