import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {ColorSwatchGrid} from '../palette/color-swatch-grid.js';
import {ColorPickerDialog} from '../palette/color-picker-dialog.js';
import {WallpaperColorPicker} from '../palette/wallpaper-color-picker.js';
import {AppColorOverrides} from '../palette/AppColorOverrides.js';
import {SPACING} from '../../constants/ui-constants.js';
import {themeState} from '../../state/ThemeState.js';
import {readFileAsText} from '../../utils/file-utils.js';
import {parseBase16Yaml} from '../../utils/base16-utils.js';
import {showToast} from '../../utils/ui-helpers.js';

/**
 * ColorPaletteSection - Manages the color palette display and editing
 * Handles color swatch grid, color picking, and per-app overrides
 */
export const ColorPaletteSection = GObject.registerClass(
    {
        Signals: {
            'color-changed': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_STRING],
            },
            'overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'palette-imported': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class ColorPaletteSection extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_top: SPACING.MD,
            });

            // Initialize from centralized state
            this._palette = themeState.getPalette();
            this._currentWallpaper = themeState.getWallpaper();
            this._appOverrides = themeState.getAppOverrides();

            this._buildUI();
            this._connectThemeState();
        }

        /**
         * Connect to centralized theme state signals
         * @private
         */
        _connectThemeState() {
            // Listen for palette changes from ThemeState
            themeState.connect('palette-changed', (_, palette) => {
                if (JSON.stringify(palette) !== JSON.stringify(this._palette)) {
                    this._palette = [...palette];
                    this._swatchGrid.setPalette(palette);
                }
            });

            // Listen for wallpaper changes
            themeState.connect('wallpaper-changed', (_, wallpaperPath) => {
                this._currentWallpaper = wallpaperPath || null;
            });

            // Listen for app overrides changes
            themeState.connect('app-overrides-changed', (_, overrides) => {
                this._appOverrides = {...overrides};
                this._appOverridesWidget.loadFromBlueprint(overrides);
            });

            // Listen for state reset
            themeState.connect('state-reset', () => {
                this.reset();
            });
        }

        _buildUI() {
            // Header with title and pick button
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
            });

            const label = new Gtk.Label({
                label: 'Color Palette',
                xalign: 0,
                hexpand: true,
                css_classes: ['title-4'],
            });
            headerBox.append(label);

            // Pick from wallpaper button
            this._pickFromWallpaperBtn = new Gtk.Button({
                icon_name: 'color-select-symbolic',
                tooltip_text: 'Pick colors from wallpaper',
            });
            this._pickFromWallpaperBtn.connect('clicked', () =>
                this._openWallpaperColorPicker()
            );
            headerBox.append(this._pickFromWallpaperBtn);

            // Import button with dropdown
            this._importMenuButton = this._createImportMenuButton();
            headerBox.append(this._importMenuButton);

            this.append(headerBox);

            // Subtitle
            const subtitle = new Gtk.Label({
                label: 'Click any color to manually edit, or pick from wallpaper',
                xalign: 0,
                margin_bottom: 6,
                css_classes: ['dim-label', 'caption'],
            });
            this.append(subtitle);

            // Color swatch grid
            this._swatchGrid = new ColorSwatchGrid((index, color, swatch) => {
                this._openColorPicker(index, color, swatch);
            });
            this.append(this._swatchGrid.widget);

            // App color overrides (always visible)
            this._advancedGroup = new Adw.PreferencesGroup({
                margin_top: SPACING.MD,
                visible: true,
            });
            this._appOverridesWidget = new AppColorOverrides();
            this._appOverridesWidget.connect(
                'overrides-changed',
                (_, overrides) => {
                    this._appOverrides = overrides;
                    // Sync to centralized state so ConfigWriter receives overrides
                    themeState.setAppOverrides(overrides);
                    this.emit('overrides-changed', overrides);
                }
            );
            this._advancedGroup.add(this._appOverridesWidget);
            this.append(this._advancedGroup);
        }

        _openColorPicker(index, currentColor, swatch) {
            const dialog = new ColorPickerDialog(
                this.get_root(),
                this._palette
            );
            dialog.openShadePicker(index, currentColor, color => {
                this._palette[index] = color;
                this._swatchGrid.updateSwatchColor(index, color);
                // Update centralized state
                themeState.setColor(index, color);
                this.emit('color-changed', index, color);
            });
        }

        _openWallpaperColorPicker() {
            if (!this._currentWallpaper) {
                console.warn('No wallpaper loaded');
                return;
            }

            const dialog = new Adw.Dialog({
                title: 'Pick Colors from Wallpaper',
                content_width: 700,
                content_height: 500,
            });

            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            // Swatch selector label
            const selectorLabel = new Gtk.Label({
                label: 'Select a color slot to replace:',
                css_classes: ['caption', 'dim-label'],
                xalign: 0,
                margin_bottom: SPACING.SM,
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
                const index = miniSwatchGrid.getSelectedIndex();

                // Update palette
                this._palette[index] = color;
                this._swatchGrid.updateSwatchColor(index, color);
                miniSwatchGrid.updateSwatchColor(index, color);
                // Update centralized state
                themeState.setColor(index, color);
                this.emit('color-changed', index, color);
            });

            // Done button
            const doneButton = new Gtk.Button({
                label: 'Done',
                css_classes: ['suggested-action'],
                halign: Gtk.Align.END,
            });
            doneButton.connect('clicked', () => dialog.close());
            content.append(doneButton);

            dialog.set_child(content);
            dialog.present(this.get_root());
        }

        setPalette(colors) {
            this._palette = [...colors];
            this._swatchGrid.setPalette(colors);
        }

        getPalette() {
            return [...this._palette];
        }

        setWallpaper(wallpaperPath) {
            this._currentWallpaper = wallpaperPath;
        }

        getLockedColors() {
            return this._swatchGrid.getLockedColors();
        }

        setLockedColors(lockedStates) {
            this._swatchGrid.setLockedColors(lockedStates);
        }

        updateColor(index, color) {
            this._palette[index] = color;
            this._swatchGrid.updateSwatchColor(index, color);
        }

        loadAppOverrides(overrides) {
            this._appOverrides = overrides;
            this._appOverridesWidget.loadFromBlueprint(overrides);
        }

        getAppOverrides() {
            return this._appOverrides;
        }

        resetAppOverrides() {
            this._appOverridesWidget.resetAllOverrides();
            this._appOverrides = {};
        }

        updateAppOverridePaletteColors(colors) {
            if (this._appOverridesWidget) {
                this._appOverridesWidget.setPaletteColors(colors);
            }
        }

        setNeovimThemeSelected(selected) {
            if (this._appOverridesWidget) {
                this._appOverridesWidget.setNeovimThemeSelected(selected);
            }
        }

        /**
         * Creates the import menu button with dropdown
         * @returns {Gtk.MenuButton} The menu button widget
         * @private
         */
        _createImportMenuButton() {
            // Create popover with import options
            const popover = new Gtk.Popover();

            const popoverBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.SM,
                margin_end: SPACING.SM,
            });

            // Base16 import option
            const base16ButtonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });
            base16ButtonBox.append(
                new Gtk.Image({icon_name: 'document-open-symbolic'})
            );
            base16ButtonBox.append(new Gtk.Label({label: 'Base16 (.yaml)'}));

            const base16Button = new Gtk.Button({
                child: base16ButtonBox,
                css_classes: ['flat'],
            });
            base16Button.connect('clicked', () => {
                popover.popdown();
                this._importBase16();
            });
            popoverBox.append(base16Button);

            popover.set_child(popoverBox);

            // Create menu button
            const menuButton = new Gtk.MenuButton({
                icon_name: 'document-open-symbolic',
                popover: popover,
                tooltip_text: 'Import color scheme',
            });

            return menuButton;
        }

        /**
         * Opens file dialog to import Base16 color scheme
         * @private
         */
        _importBase16() {
            const dialog = new Gtk.FileDialog({
                title: 'Import Base16 Color Scheme',
            });

            // Create filter for YAML files
            const filter = new Gtk.FileFilter();
            filter.set_name('Base16 YAML Files');
            filter.add_pattern('*.yaml');
            filter.add_pattern('*.yml');

            const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
            filterList.append(filter);
            dialog.set_filters(filterList);

            dialog.open(this.get_root(), null, (source, result) => {
                try {
                    const file = dialog.open_finish(result);
                    if (file) {
                        const filePath = file.get_path();
                        this._processBase16File(filePath);
                    }
                } catch (e) {
                    // User cancelled or error
                    if (!e.message.includes('Dismissed')) {
                        console.error('File picker error:', e.message);
                    }
                }
            });
        }

        /**
         * Processes and applies a Base16 YAML file
         * @param {string} filePath - Path to the Base16 YAML file
         * @private
         */
        _processBase16File(filePath) {
            try {
                const content = readFileAsText(filePath);
                const result = parseBase16Yaml(content);

                if (result.colors && result.colors.length === 16) {
                    // Apply the imported colors
                    this._palette = [...result.colors];
                    this._swatchGrid.setPalette(result.colors);

                    // Update centralized state
                    themeState.setPalette(result.colors);

                    // Emit signal for parent components
                    this.emit('palette-imported', {
                        colors: result.colors,
                        scheme: result.scheme,
                        author: result.author,
                    });

                    // Show success toast
                    showToast(this, `Imported: ${result.scheme}`);
                }
            } catch (error) {
                console.error('Failed to import Base16 scheme:', error.message);
                showToast(this, `Import failed: ${error.message}`, 4);
            }
        }

        reset() {
            this._palette = [];
            this._currentWallpaper = null;
            this._swatchGrid.setLockedColors(new Array(16).fill(false));
        }
    }
);
