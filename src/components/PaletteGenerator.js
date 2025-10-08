import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {extractColorsFromWallpaper} from '../services/wallpaper-service.js';
import {adjustColor} from '../utils/color-utils.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {ColorSwatchGrid} from './palette/color-swatch-grid.js';
import {ColorPickerDialog} from './palette/color-picker-dialog.js';
import {WallpaperBrowser} from './WallpaperBrowser.js';

export const PaletteGenerator = GObject.registerClass(
    {
        Signals: {
            'palette-generated': {param_types: [GObject.TYPE_JSOBJECT]},
            'adjustments-applied': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class PaletteGenerator extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            this._palette = [];
            this._originalPalette = [];
            this._currentWallpaper = null;
            this._lightMode = false;

            this._initializeUI();
        }

        _initializeUI() {
            // View stack for the modes
            this._viewStack = new Adw.ViewStack();

            // Tab 1: Unified Palette Editor (combines wallpaper + custom)
            const paletteView = this._createPaletteEditorView();
            const palettePage = this._viewStack.add_titled(
                paletteView,
                'editor',
                'Palette Editor'
            );
            palettePage.set_icon_name('preferences-color-symbolic');

            // Tab 2: Find Wallpaper
            this._wallpaperBrowser = new WallpaperBrowser();
            this._wallpaperBrowser.connect('wallpaper-selected', (_, path) => {
                this._onWallpaperBrowserSelected(path);
            });
            const browserPage = this._viewStack.add_titled(
                this._wallpaperBrowser,
                'browser',
                'Find Wallpaper'
            );
            browserPage.set_icon_name('network-workgroup-symbolic');

            // Header box with view switcher
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            // View switcher title for tabs at the top
            const viewSwitcherTitle = new Adw.ViewSwitcherTitle();
            viewSwitcherTitle.set_stack(this._viewStack);
            viewSwitcherTitle.set_title('Palette Source');
            viewSwitcherTitle.set_hexpand(true);

            headerBox.append(viewSwitcherTitle);

            this.append(headerBox);
            this.append(this._viewStack);

            // Load default colors after UI is ready
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultCustomColors();
                return GLib.SOURCE_REMOVE;
            });
        }

        _createPaletteEditorView() {
            const viewBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                hexpand: true,
            });

            // Wallpaper selection row - wrapped in PreferencesGroup for full width
            const wallpaperGroup = new Adw.PreferencesGroup();

            const wallpaperRow = new Adw.ActionRow({
                title: 'Wallpaper',
                subtitle: 'Select an image for reference or extraction',
            });

            const selectButton = new Gtk.Button({
                icon_name: 'document-open-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Select wallpaper',
            });
            selectButton.connect('clicked', () => this._selectWallpaper());
            wallpaperRow.add_suffix(selectButton);

            this._setupDropTarget(wallpaperRow);
            wallpaperGroup.add(wallpaperRow);
            viewBox.append(wallpaperGroup);

            // Extract colors section (only visible when wallpaper is loaded)
            this._extractSection = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                halign: Gtk.Align.FILL,
                hexpand: true,
                margin_top: 12,
                visible: false,
            });

            // Button and spinner row
            const extractActionRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                halign: Gtk.Align.START,
            });

            const extractButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            const extractIcon = new Gtk.Image({
                icon_name: 'color-select-symbolic',
            });

            const extractLabel = new Gtk.Label({
                label: 'Extract',
            });

            extractButtonBox.append(extractIcon);
            extractButtonBox.append(extractLabel);

            this._extractButton = new Gtk.Button({
                child: extractButtonBox,
                css_classes: ['suggested-action'],
            });
            this._extractButton.connect('clicked', () => {
                if (this._currentWallpaper) {
                    this._extractColors(this._currentWallpaper);
                }
            });

            // Loading spinner (on same line as button)
            this._spinner = new Gtk.Spinner({
                width_request: 24,
                height_request: 24,
                valign: Gtk.Align.CENTER,
                visible: false,
            });

            extractActionRow.append(this._extractButton);
            extractActionRow.append(this._spinner);

            // Helper text below button
            const extractHelperText = new Gtk.Label({
                label: 'Extract colors from the wallpaper using pywal',
                css_classes: ['dim-label', 'caption'],
                wrap: true,
                xalign: 0,
            });

            this._extractSection.append(extractActionRow);
            this._extractSection.append(extractHelperText);
            viewBox.append(this._extractSection);

            // Wallpaper preview
            this._wallpaperPreview = new Gtk.Picture({
                height_request: 200,
                can_shrink: true,
                css_classes: ['card'],
                hexpand: true,
                visible: false,
            });
            viewBox.append(this._wallpaperPreview);

            // Color swatch grid section
            const colorsLabel = new Gtk.Label({
                label: 'Color Palette',
                xalign: 0,
                margin_top: 12,
                css_classes: ['title-4'],
            });
            viewBox.append(colorsLabel);

            const colorsSubtitle = new Gtk.Label({
                label: 'Click any color to manually edit',
                xalign: 0,
                margin_bottom: 6,
                css_classes: ['dim-label', 'caption'],
            });
            viewBox.append(colorsSubtitle);

            // Color swatch grid
            this._swatchGrid = new ColorSwatchGrid((index, color, swatch) => {
                this._openColorPicker(index, color, swatch);
            });
            viewBox.append(this._swatchGrid.widget);

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

        _setupDropTarget(widget) {
            const dropTarget = Gtk.DropTarget.new(
                Gio.File.$gtype,
                Gdk.DragAction.COPY
            );

            dropTarget.connect('drop', (target, value) => {
                if (value instanceof Gio.File) {
                    this.loadWallpaperWithoutExtraction(value.get_path());
                    return true;
                }
                return false;
            });

            widget.add_controller(dropTarget);
        }

        _selectWallpaper() {
            const dialog = new Gtk.FileDialog({title: 'Select Wallpaper'});

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
                        this.loadWallpaperWithoutExtraction(file.get_path());
                    }
                } catch (e) {
                    if (
                        !e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)
                    ) {
                        console.error('Error selecting file:', e.message);
                    }
                }
            });
        }

        loadWallpaper(path) {
            // Load wallpaper without extraction - user must click extract button
            this._currentWallpaper = path;

            const file = Gio.File.new_for_path(path);
            this._wallpaperPreview.set_file(file);
            this._wallpaperPreview.set_visible(true);
            this._extractSection.set_visible(true);
        }

        _onWallpaperBrowserSelected(path) {
            // Switch to editor tab
            this._viewStack.set_visible_child_name('editor');

            // Load the wallpaper without auto-extraction
            this.loadWallpaper(path);
        }

        loadWallpaperWithoutExtraction(path) {
            // For manual selection - just show wallpaper and extract button, don't auto-extract
            this._currentWallpaper = path;

            const file = Gio.File.new_for_path(path);
            this._wallpaperPreview.set_file(file);
            this._wallpaperPreview.set_visible(true);
            this._extractSection.set_visible(true);
        }

        _extractColors(imagePath) {
            this._showLoading(true);

            extractColorsFromWallpaper(
                imagePath,
                this._lightMode,
                colors => {
                    this._originalPalette = [...colors];
                    this.setPalette(colors);
                    this.emit('palette-generated', colors);
                    this._showLoading(false);
                },
                error => {
                    console.error('Error extracting colors:', error.message);
                    this._showLoading(false);
                }
            );
        }

        applyPreset(preset) {
            this._originalPalette = [...preset.colors];
            this.setPalette(preset.colors);
            this.emit('palette-generated', preset.colors);
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
            const picker = new ColorPickerDialog(
                this.get_root(),
                this._palette
            );

            picker.openShadePicker(index, color, newColor => {
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
                lightMode: this._lightMode,
            };
        }

        switchToEditorTab() {
            if (this._viewStack) {
                this._viewStack.set_visible_child_name('editor');
            }
        }

        // Kept for backwards compatibility
        switchToCustomTab() {
            this.switchToEditorTab();
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

            // Load light mode setting
            if (palette.lightMode !== undefined) {
                this._lightMode = palette.lightMode;
            }

            // Reset all locks when loading blueprint
            this._swatchGrid.setLockedColors(new Array(16).fill(false));
        }

        setLightMode(lightMode) {
            this._lightMode = lightMode;
            // Don't re-extract automatically - user must click the extract button
        }

        getLightMode() {
            return this._lightMode;
        }

        get widget() {
            return this;
        }
    }
);
