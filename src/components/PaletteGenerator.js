import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { extractColorsFromWallpaper } from '../services/wallpaper-service.js';
import { adjustColor } from '../utils/color-utils.js';
import { applyCssToWidget } from '../utils/ui-helpers.js';
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

        this._initializeUI();
    }

    _initializeUI() {
        // View stack for the two modes
        this._viewStack = new Adw.ViewStack();

        // Tab 1: Wallpaper Extraction
        const wallpaperView = this._createWallpaperView();
        const wallpaperPage = this._viewStack.add_titled(wallpaperView, 'wallpaper', 'From Wallpaper');
        wallpaperPage.set_icon_name('image-x-generic-symbolic');

        // Tab 2: Custom Palette
        const customView = this._createCustomView();
        const customPage = this._viewStack.add_titled(customView, 'custom', 'Custom');
        customPage.set_icon_name('preferences-color-symbolic');

        // View switcher title for tabs at the top
        const viewSwitcherTitle = new Adw.ViewSwitcherTitle();
        viewSwitcherTitle.set_stack(this._viewStack);
        viewSwitcherTitle.set_title('Palette Source');

        this.append(viewSwitcherTitle);
        this.append(this._viewStack);

        // Color preview container
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

        // Load default colors for custom tab after UI is ready
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._loadDefaultCustomColors();
            return GLib.SOURCE_REMOVE;
        });
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

    _createCustomView() {
        const viewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
        });

        // Wallpaper for reference
        const wallpaperReferenceRow = new Adw.ActionRow({
            title: 'Add Wallpaper',
            subtitle: 'Select wallpaper for visual reference',
        });

        const selectRefButton = new Gtk.Button({
            icon_name: 'document-open-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Select wallpaper',
        });
        selectRefButton.connect('clicked', () => this._selectCustomWallpaper());
        wallpaperReferenceRow.add_suffix(selectRefButton);

        viewBox.append(wallpaperReferenceRow);

        // Custom wallpaper preview
        this._customWallpaperPreview = new Gtk.Picture({
            height_request: 200,
            can_shrink: true,
            css_classes: ['card'],
            hexpand: true,
            visible: false,
        });
        viewBox.append(this._customWallpaperPreview);

        return viewBox;
    }

    _loadDefaultCustomColors() {
        // Default custom palette - modern neutral theme
        const defaultColors = [
            '#1e1e2e', // background - dark blue-gray
            '#f38ba8', // red
            '#a6e3a1', // green
            '#f9e2af', // yellow
            '#89b4fa', // blue
            '#cba6f7', // magenta
            '#94e2d5', // cyan
            '#cdd6f4', // foreground - light gray
            '#45475a', // bright black
            '#f38ba8', // bright red
            '#a6e3a1', // bright green
            '#f9e2af', // bright yellow
            '#89b4fa', // bright blue
            '#cba6f7', // bright magenta
            '#94e2d5', // bright cyan
            '#ffffff', // bright white
        ];

        this._originalPalette = [...defaultColors];
        this.setPalette(defaultColors);
        this.emit('palette-generated', defaultColors);
    }

    _selectCustomWallpaper() {
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
                    this._currentWallpaper = file.get_path();
                    this._customWallpaperPreview.set_file(file);
                    this._customWallpaperPreview.set_visible(true);
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('Error selecting file:', e.message);
                }
            }
        });
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

        // Also set custom wallpaper preview if it exists
        if (this._customWallpaperPreview) {
            this._customWallpaperPreview.set_file(file);
            this._customWallpaperPreview.set_visible(true);
        }

        this._extractColors(path);
    }

    loadWallpaperWithoutExtraction(path) {
        // For blueprints loaded in custom tab - just set wallpaper preview, don't extract
        this._currentWallpaper = path;

        const file = Gio.File.new_for_path(path);

        if (this._customWallpaperPreview) {
            this._customWallpaperPreview.set_file(file);
            this._customWallpaperPreview.set_visible(true);
        }
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


    applyPreset(preset) {
        this._originalPalette = [...preset.colors];
        this.setPalette(preset.colors);
        this.emit('palette-generated', preset.colors);
        console.log(`Applied preset: ${preset.name}`);
    }

    applyHarmony(colors) {
        this._originalPalette = [...colors];
        this.setPalette(colors);
        this.emit('palette-generated', colors);
    }

    _applyAdjustments(values) {
        if (this._originalPalette.length === 0) return;

        const lockedColors = this._swatchGrid.getLockedColors();

        const adjustedColors = this._originalPalette.map((color, index) => {
            // Skip adjustment for locked colors
            if (lockedColors[index]) {
                return this._palette[index]; // Keep current locked color
            }

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
        this._wallpaperPreview.set_file(null);
        if (this._customWallpaperPreview) {
            this._customWallpaperPreview.set_file(null);
            this._customWallpaperPreview.set_visible(false);
        }
        this._swatchGrid.setPalette([]);
        this._swatchGrid.setLockedColors(new Array(16).fill(false)); // Reset all locks
        this._showLoading(false);
    }

    getPalette() {
        return {
            wallpaper: this._currentWallpaper,
            colors: this._palette,
        };
    }

    switchToCustomTab() {
        if (this._viewStack) {
            this._viewStack.set_visible_child_name('custom');
        }
    }

    loadBlueprintPalette(palette) {
        // Load colors
        if (palette.colors) {
            this._originalPalette = [...palette.colors]; // Save as original for adjustments
            this.setPalette(palette.colors);
        }

        // Load wallpaper without extraction
        if (palette.wallpaper) {
            this.loadWallpaperWithoutExtraction(palette.wallpaper);
        }

        // Reset all locks when loading blueprint
        this._swatchGrid.setLockedColors(new Array(16).fill(false));
    }

    get widget() {
        return this;
    }
});
