import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {extractColorsFromWallpaper} from '../services/wallpaper-service.js';
import {adjustColor} from '../utils/color-utils.js';
import {ColorSwatchGrid} from './palette/color-swatch-grid.js';
import {ColorPickerDialog} from './palette/color-picker-dialog.js';
import {WallpaperBrowser} from './WallpaperBrowser.js';
import {LocalWallpaperBrowser} from './LocalWallpaperBrowser.js';
import {FavoritesView} from './FavoritesView.js';
import {WallpaperColorPicker} from './palette/wallpaper-color-picker.js';
import {AppColorOverrides} from './palette/AppColorOverrides.js';
import {registerCustomIcons} from '../utils/icon-utils.js';

export const PaletteGenerator = GObject.registerClass(
    {
        Signals: {
            'palette-generated': {param_types: [GObject.TYPE_JSOBJECT]},
            'adjustments-applied': {param_types: [GObject.TYPE_JSOBJECT]},
            'overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'open-wallpaper-editor': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class PaletteGenerator extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            // Register custom icons on first initialization
            registerCustomIcons();

            this._palette = [];
            this._originalPalette = [];
            this._currentWallpaper = null;
            this._lightMode = false;
            this._appOverrides = {};

            this._initializeUI();
        }

        _initializeUI() {
            // View stack for the modes
            this._viewStack = new Adw.ViewStack();

            // Tab 1: Palette Editor
            const paletteView = this._createPaletteEditorView();
            const palettePage = this._viewStack.add_titled(
                paletteView,
                'editor',
                'Editor'
            );
            palettePage.set_icon_name('preferences-color-symbolic');

            // Add invisible separator page (not clickable, just for visual grouping)
            const separatorPage = this._viewStack.add_titled(
                new Gtk.Box(),
                'separator',
                '│'
            );
            // Make separator non-interactive by not showing it in switcher
            separatorPage.set_visible(false);

            // Tab 2: Wallhaven Browser
            this._wallhavenBrowser = new WallpaperBrowser();
            this._wallhavenBrowser.connect('wallpaper-selected', (_, path) => {
                this._onWallpaperBrowserSelected(path);
            });
            this._wallhavenBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._viewStack.add_titled(
                this._wallhavenBrowser,
                'wallhaven',
                'Wallhaven'
            );

            // Tab 3: Local Wallpapers
            this._localBrowser = new LocalWallpaperBrowser();
            this._localBrowser.connect('wallpaper-selected', (_, path) => {
                this._onWallpaperBrowserSelected(path);
            });
            this._localBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._viewStack.add_titled(this._localBrowser, 'local', 'Local');

            // Tab 4: Favorites
            this._favoritesView = new FavoritesView();
            this._favoritesView.connect('wallpaper-selected', (_, path) => {
                this._onWallpaperBrowserSelected(path);
            });
            this._viewStack.add_titled(
                this._favoritesView,
                'favorites',
                'Favorites'
            );

            // Monitor tab changes to reload favorites
            this._viewStack.connect('notify::visible-child-name', () => {
                if (this._viewStack.get_visible_child_name() === 'favorites') {
                    this._favoritesView.loadFavorites();
                }
            });

            // Custom header with separated tab groups
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            // Spacer to push tabs to the right
            const spacer = new Gtk.Box({
                hexpand: true,
            });
            headerBox.append(spacer);

            // Create custom tab bar with separator
            const tabBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                css_classes: ['linked'],
            });

            // Editor tab button
            const editorBtn = new Gtk.ToggleButton({
                active: true,
            });
            const editorBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            editorBox.append(
                new Gtk.Image({
                    icon_name: 'edit-cover-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            editorBox.append(new Gtk.Label({label: 'Editor'}));
            editorBtn.set_child(editorBox);
            editorBtn.connect('clicked', () => {
                this._viewStack.set_visible_child_name('editor');
                this._updateTabButtons(editorBtn);
            });
            tabBox.append(editorBtn);

            // Visual separator
            const separator = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
            });
            tabBox.append(separator);

            // Wallhaven tab button
            const wallhavenBtn = new Gtk.ToggleButton();
            const wallhavenBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            wallhavenBox.append(
                new Gtk.Image({
                    icon_name: 'system-search-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            wallhavenBox.append(new Gtk.Label({label: 'Wallhaven'}));
            wallhavenBtn.set_child(wallhavenBox);
            wallhavenBtn.connect('clicked', () => {
                this._viewStack.set_visible_child_name('wallhaven');
                this._updateTabButtons(wallhavenBtn);
            });
            tabBox.append(wallhavenBtn);

            // Local tab button
            const localBtn = new Gtk.ToggleButton();
            const localBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            localBox.append(
                new Gtk.Image({
                    icon_name: 'wallpaper-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            localBox.append(new Gtk.Label({label: 'Local'}));
            localBtn.set_child(localBox);
            localBtn.connect('clicked', () => {
                this._viewStack.set_visible_child_name('local');
                this._updateTabButtons(localBtn);
            });
            tabBox.append(localBtn);

            // Favorites tab button
            const favBtn = new Gtk.ToggleButton();
            const favBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            favBox.append(
                new Gtk.Image({
                    icon_name: 'emblem-favorite-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            favBox.append(new Gtk.Label({label: 'Favorites'}));
            favBtn.set_child(favBox);
            favBtn.connect('clicked', () => {
                this._viewStack.set_visible_child_name('favorites');
                this._updateTabButtons(favBtn);
            });
            tabBox.append(favBtn);

            // Store button references
            this._tabButtons = [editorBtn, wallhavenBtn, localBtn, favBtn];

            headerBox.append(tabBox);

            this.append(headerBox);
            this.append(this._viewStack);

            // Load default colors after UI is ready
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultCustomColors();
                return GLib.SOURCE_REMOVE;
            });
        }

        _updateTabButtons(activeButton) {
            // Deactivate all buttons except the clicked one
            this._tabButtons.forEach(btn => {
                if (btn !== activeButton) {
                    btn.set_active(false);
                }
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
                subtitle: 'Select, edit, and extract colors from an image',
            });

            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

            const selectButton = new Gtk.Button({
                icon_name: 'document-open-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Select wallpaper',
            });
            selectButton.connect('clicked', () => this._selectWallpaper());
            buttonBox.append(selectButton);

            // Extract button (initially hidden)
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
                visible: false,
            });
            this._extractButton.connect('clicked', () => {
                if (this._currentWallpaper) {
                    this._extractColors(this._currentWallpaper);
                }
            });
            buttonBox.append(this._extractButton);

            // Edit wallpaper button (initially hidden)
            const editButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            const editIcon = new Gtk.Image({
                icon_name: 'image-edit-symbolic',
            });

            const editLabel = new Gtk.Label({
                label: 'Edit',
            });

            editButtonBox.append(editIcon);
            editButtonBox.append(editLabel);

            this._editWallpaperBtn = new Gtk.Button({
                child: editButtonBox,
                tooltip_text:
                    'Edit wallpaper (apply filters before extraction)',
                visible: false,
            });
            this._editWallpaperBtn.connect('clicked', () =>
                this._openWallpaperEditor()
            );
            buttonBox.append(this._editWallpaperBtn);

            // Loading spinner
            this._spinner = new Gtk.Spinner({
                width_request: 24,
                height_request: 24,
                valign: Gtk.Align.CENTER,
                visible: false,
            });
            buttonBox.append(this._spinner);

            wallpaperRow.add_suffix(buttonBox);

            this._setupDropTarget(wallpaperRow);
            wallpaperGroup.add(wallpaperRow);
            viewBox.append(wallpaperGroup);

            // Wallpaper preview
            this._wallpaperPreview = new Gtk.Picture({
                height_request: 200,
                can_shrink: true,
                content_fit: Gtk.ContentFit.CONTAIN,
                css_classes: ['card'],
                hexpand: true,
                visible: false,
            });
            viewBox.append(this._wallpaperPreview);

            // Color swatch grid section
            const colorsHeaderBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 12,
            });

            const colorsLabel = new Gtk.Label({
                label: 'Color Palette',
                xalign: 0,
                hexpand: true,
                css_classes: ['title-4'],
            });
            colorsHeaderBox.append(colorsLabel);

            // Pick from wallpaper button (only visible when wallpaper is loaded)
            this._pickFromWallpaperBtn = new Gtk.Button({
                icon_name: 'color-select-symbolic',
                tooltip_text: 'Pick colors from wallpaper',
                visible: false,
            });
            this._pickFromWallpaperBtn.connect('clicked', () => {
                this._openWallpaperColorPicker();
            });
            colorsHeaderBox.append(this._pickFromWallpaperBtn);

            viewBox.append(colorsHeaderBox);

            const colorsSubtitle = new Gtk.Label({
                label: 'Click any color to manually edit, or pick from wallpaper',
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

            // Advanced section: App Color Overrides (collapsed by default, hidden initially)
            this._advancedGroup = new Adw.PreferencesGroup({
                margin_top: 12,
                visible: false, // Hidden by default (experimental feature)
            });
            this._appOverridesWidget = new AppColorOverrides();
            this._appOverridesWidget.connect(
                'overrides-changed',
                (_, overrides) => {
                    this._appOverrides = overrides;
                    this.emit('overrides-changed', overrides);
                }
            );
            this._advancedGroup.add(this._appOverridesWidget);
            viewBox.append(this._advancedGroup);

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

            // Force complete reload by using texture instead of file
            // This ensures GTK doesn't cache the old image
            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                this._wallpaperPreview.set_paintable(texture);
                this._wallpaperPreview.set_visible(true);
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
                // Fallback to file method
                const file = Gio.File.new_for_path(path);
                this._wallpaperPreview.set_file(file);
                this._wallpaperPreview.set_visible(true);
            }

            this._extractButton.set_visible(true);
            this._pickFromWallpaperBtn.set_visible(true);
            this._editWallpaperBtn.set_visible(true);
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

            // Force complete reload by using texture instead of file
            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                this._wallpaperPreview.set_paintable(texture);
                this._wallpaperPreview.set_visible(true);
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
                // Fallback to file method
                const file = Gio.File.new_for_path(path);
                this._wallpaperPreview.set_file(file);
                this._wallpaperPreview.set_visible(true);
            }

            this._extractButton.set_visible(true);
            this._pickFromWallpaperBtn.set_visible(true);
            this._editWallpaperBtn.set_visible(true);
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

        _openWallpaperColorPicker() {
            if (!this._currentWallpaper) return;

            const dialog = this._createColorPickerDialog();
            const dialogContent = this._createDialogContent(dialog);

            dialog.set_child(dialogContent);
            dialog.present(this.get_root());
        }

        _openWallpaperEditor() {
            if (!this._currentWallpaper) return;

            // Emit signal to let main window handle the navigation
            this.emit('open-wallpaper-editor', this._currentWallpaper);
        }

        _createColorPickerDialog() {
            return new Adw.Dialog({
                title: 'Pick Colors from Wallpaper',
                content_width: 700,
                content_height: 500,
            });
        }

        _createDialogContent(dialog) {
            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            // Swatch selector label
            const selectorLabel = new Gtk.Label({
                label: 'Select a color slot to replace:',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
                margin_bottom: 6,
            });
            content.append(selectorLabel);

            // Create mini swatch grid (reuse ColorSwatchGrid in mini mode)
            const miniSwatchGrid = new ColorSwatchGrid(null, {
                miniMode: true,
                showLockButtons: false,
                selectedIndex: 0,
            });
            miniSwatchGrid.setPalette([...this._palette]);
            content.append(miniSwatchGrid.widget);

            // Create color picker
            const colorPicker = new WallpaperColorPicker(
                this._currentWallpaper
            );
            content.append(colorPicker);

            // Handle color selection
            colorPicker.connect('color-picked', (_, color) => {
                this._handleColorPicked(color, miniSwatchGrid);
            });

            // Done button
            content.append(this._createDoneButton(dialog));

            return content;
        }

        _handleColorPicked(color, miniSwatchGrid) {
            const index = miniSwatchGrid.getSelectedIndex();

            // Update palette
            this._palette[index] = color;

            // Update main swatch grid
            this._swatchGrid.updateSwatchColor(index, color);

            // Update mini swatch grid
            miniSwatchGrid.updateSwatchColor(index, color);

            // Emit signal
            this.emit('palette-generated', this._palette);
        }

        _createDoneButton(dialog) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_top: 12,
                halign: Gtk.Align.END,
            });

            const doneButton = new Gtk.Button({
                label: 'Done',
                css_classes: ['suggested-action'],
            });
            doneButton.connect('clicked', () => dialog.close());

            buttonBox.append(doneButton);
            return buttonBox;
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
                appOverrides: this._appOverrides,
            };
        }

        getAppOverrides() {
            return this._appOverrides;
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

            // Load app overrides
            if (palette.appOverrides) {
                this._appOverrides = palette.appOverrides;
                this._appOverridesWidget.loadFromBlueprint(
                    palette.appOverrides
                );
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

        setAppOverridesVisible(visible) {
            if (this._advancedGroup) {
                this._advancedGroup.set_visible(visible);
            }
        }

        get widget() {
            return this;
        }
    }
);
