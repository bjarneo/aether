import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {extractColorsFromWallpaperIM} from '../utils/imagemagick-color-extraction.js';
import {adjustColor} from '../utils/color-utils.js';
import {uploadWallpaper, uploadMultipleWallpapers} from '../utils/wallpaper-utils.js';
import {copyFile} from '../utils/file-utils.js';
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
            'apply-wallpaper': {},
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
            this._additionalImages = []; // Store additional background images
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

            // Empty state - shown when no wallpaper is loaded
            this._emptyStateBox = this._createEmptyState();
            viewBox.append(this._emptyStateBox);

            // Wallpaper selection row - wrapped in PreferencesGroup for full width
            this._wallpaperGroup = new Adw.PreferencesGroup({
                visible: false, // Hidden initially until wallpaper is loaded
            });

            const wallpaperRow = new Adw.ActionRow({
                title: 'Wallpaper',
                subtitle: 'Select, edit, and extract colors from an image',
            });

            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                valign: Gtk.Align.CENTER,
            });

            // ImageMagick extract button
            const imExtractButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            const imExtractIcon = new Gtk.Image({
                icon_name: 'color-select-symbolic',
            });

            const imExtractLabel = new Gtk.Label({
                label: 'Extract',
            });

            imExtractButtonBox.append(imExtractIcon);
            imExtractButtonBox.append(imExtractLabel);

            this._imExtractButton = new Gtk.Button({
                child: imExtractButtonBox,
                css_classes: ['suggested-action'],
                tooltip_text: 'Extract colors from wallpaper',
            });
            this._imExtractButton.connect('clicked', () => {
                if (this._currentWallpaper) {
                    this._extractColorsIM(this._currentWallpaper);
                }
            });
            buttonBox.append(this._imExtractButton);

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
            });
            this._editWallpaperBtn.connect('clicked', () =>
                this._openWallpaperEditor()
            );
            buttonBox.append(this._editWallpaperBtn);

            // Apply only wallpaper button (right side)
            const applyWallpaperButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            const applyWallpaperButtonIcon = new Gtk.Image({
                icon_name: 'wallpaper-symbolic',
            });

            const applyWallpaperLabel = new Gtk.Label({
                label: 'Apply',
            });

            applyWallpaperButtonBox.append(applyWallpaperButtonIcon);
            applyWallpaperButtonBox.append(applyWallpaperLabel);

            this._applyWallpaperBtn = new Gtk.Button({
                child: applyWallpaperButtonBox,
                tooltip_text: 'Apply wallpaper to the desktop',
            });
            this._applyWallpaperBtn.connect('clicked', () =>
                this.emit('apply-wallpaper')
            );
            buttonBox.append(this._applyWallpaperBtn);

            // Loading spinner
            this._spinner = new Gtk.Spinner({
                width_request: 24,
                height_request: 24,
                valign: Gtk.Align.CENTER,
                visible: false,
            });
            buttonBox.append(this._spinner);

            wallpaperRow.add_suffix(buttonBox);

            this._wallpaperGroup.add(wallpaperRow);

            // Wallpaper preview (hidden with wallpaperGroup)
            this._wallpaperPreview = new Gtk.Picture({
                height_request: 200,
                can_shrink: true,
                content_fit: Gtk.ContentFit.CONTAIN,
                css_classes: ['card'],
                hexpand: true,
                visible: false, // Hidden by default, shown when wallpaper loads
            });
            this._wallpaperGroup.add(this._wallpaperPreview);

            // Additional images section (hidden until main wallpaper is loaded)
            this._additionalImagesBox = this._createAdditionalImagesSection();
            this._wallpaperGroup.add(this._additionalImagesBox);

            viewBox.append(this._wallpaperGroup);

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

        _createAdditionalImagesSection() {
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 12,
                visible: true, // Always visible when wallpaper is loaded
            });

            // Header with label and add button
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const label = new Gtk.Label({
                label: 'Additional Images',
                xalign: 0,
                hexpand: true,
                css_classes: ['caption'],
            });
            headerBox.append(label);

            // Add image button
            const addButton = new Gtk.Button({
                icon_name: 'list-add-symbolic',
                tooltip_text: 'Add additional background images',
                css_classes: ['flat'],
            });
            addButton.connect('clicked', () => this._addAdditionalImage());
            headerBox.append(addButton);

            container.append(headerBox);

            // Grid for additional images (hidden when empty)
            this._additionalImagesGrid = new Gtk.FlowBox({
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 6,
                row_spacing: 6,
                homogeneous: true,
                max_children_per_line: 4,
                min_children_per_line: 2,
                visible: false, // Hidden until images are added
            });
            container.append(this._additionalImagesGrid);

            return container;
        }

        _addAdditionalImage() {
            uploadMultipleWallpapers(this.get_root(), destPaths => {
                if (destPaths && destPaths.length > 0) {
                    this._additionalImages.push(...destPaths);
                    this._updateAdditionalImagesDisplay();
                }
            });
        }

        _updateAdditionalImagesDisplay() {
            // Clear existing items
            let child = this._additionalImagesGrid.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._additionalImagesGrid.remove(child);
                child = next;
            }

            // Show/hide grid based on images
            this._additionalImagesGrid.set_visible(this._additionalImages.length > 0);

            // Add image cards
            this._additionalImages.forEach((imagePath, index) => {
                const card = this._createImageCard(imagePath, index);
                this._additionalImagesGrid.append(card);
            });
        }

        _createImageCard(imagePath, index) {
            const overlay = new Gtk.Overlay();

            // Image preview
            const picture = new Gtk.Picture({
                width_request: 120,
                height_request: 80,
                can_shrink: true,
                content_fit: Gtk.ContentFit.COVER,
                css_classes: ['card'],
            });

            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(imagePath);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                picture.set_paintable(texture);
            } catch (e) {
                console.error('Failed to load additional image:', e);
            }

            overlay.set_child(picture);

            // Remove button
            const removeBtn = new Gtk.Button({
                icon_name: 'window-close-symbolic',
                css_classes: ['circular', 'destructive-action'],
                halign: Gtk.Align.END,
                valign: Gtk.Align.START,
                margin_top: 6,
                margin_end: 6,
            });
            removeBtn.connect('clicked', () => {
                this._additionalImages.splice(index, 1);
                this._updateAdditionalImagesDisplay();
            });
            overlay.add_overlay(removeBtn);

            return overlay;
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

        _createEmptyState() {
            const emptyBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: 24,
                margin_top: 48,
                margin_bottom: 48,
                hexpand: true,
                vexpand: true,
            });

            const icon = new Gtk.Image({
                icon_name: 'folder-pictures-symbolic',
                pixel_size: 72,
                css_classes: ['dim-label'],
            });

            const titleLabel = new Gtk.Label({
                label: 'No Wallpaper Selected',
                css_classes: ['title-2'],
            });

            const subtitleLabel = new Gtk.Label({
                label: 'Choose a wallpaper to begin creating your theme',
                css_classes: ['dim-label'],
            });

            const uploadButton = new Gtk.Button({
                label: 'Select Wallpaper',
                css_classes: ['pill', 'suggested-action'],
                halign: Gtk.Align.CENTER,
            });
            uploadButton.connect('clicked', () => {
                this._uploadWallpaper();
            });

            emptyBox.append(icon);
            emptyBox.append(titleLabel);
            emptyBox.append(subtitleLabel);
            emptyBox.append(uploadButton);

            return emptyBox;
        }

        _uploadWallpaper() {
            uploadWallpaper(this.get_root(), destPath => {
                // Load the wallpaper from ~/Wallpapers
                this.loadWallpaperWithoutExtraction(destPath);
            });
        }

        loadWallpaper(path) {
            // Load wallpaper without extraction - user must click extract button
            this._currentWallpaper = path;

            // Hide empty state, show wallpaper controls
            this._emptyStateBox.set_visible(false);
            this._wallpaperGroup.set_visible(true);

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

            // Hide empty state, show wallpaper controls
            this._emptyStateBox.set_visible(false);
            this._wallpaperGroup.set_visible(true);

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
        }

        _extractColorsIM(imagePath) {
            this._showLoading(true);

            // Get currently locked colors before extraction
            const lockedColors = this._swatchGrid.getLockedColors();
            const currentPalette = [...this._palette];

            extractColorsFromWallpaperIM(
                imagePath,
                this._lightMode,
                colors => {
                    // Merge extracted colors with locked colors
                    const mergedColors = colors.map((color, index) => {
                        // Keep locked colors unchanged
                        if (lockedColors[index] && currentPalette[index]) {
                            return currentPalette[index];
                        }
                        return color;
                    });

                    this._originalPalette = [...mergedColors];
                    this.setPalette(mergedColors);
                    this.emit('palette-generated', mergedColors);
                    this._showLoading(false);
                },
                error => {
                    console.error(
                        'Error extracting colors with ImageMagick:',
                        error.message
                    );
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
            this._currentWallpaper = null;
            this._additionalImages = [];
            this._updateAdditionalImagesDisplay();
            this._wallpaperPreview.set_file(null);
            this._wallpaperPreview.set_visible(false);
            if (this._customWallpaperPreview) {
                this._customWallpaperPreview.set_file(null);
            }

            // Show empty state, hide wallpaper controls
            this._emptyStateBox.set_visible(true);
            this._wallpaperGroup.set_visible(false);

            this._swatchGrid.setLockedColors(new Array(16).fill(false)); // Reset all locks
            this._showLoading(false);

            // Reload default colors
            this._loadDefaultCustomColors();
        }

        getPalette() {
            return {
                wallpaper: this._currentWallpaper,
                colors: this._palette,
                lightMode: this._lightMode,
                appOverrides: this._appOverrides,
                additionalImages: this._additionalImages,
            };
        }

        getAdditionalImages() {
            return [...this._additionalImages];
        }

        getAppOverrides() {
            return this._appOverrides;
        }

        resetAppOverrides() {
            this._appOverrides = {};
            if (this._appOverridesWidget) {
                this._appOverridesWidget.setOverrides({});
            }
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

            // Load additional images
            if (palette.additionalImages && Array.isArray(palette.additionalImages)) {
                this._additionalImages = [...palette.additionalImages];
                this._updateAdditionalImagesDisplay();
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
