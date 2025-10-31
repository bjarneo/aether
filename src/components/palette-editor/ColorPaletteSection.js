import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {ColorSwatchGrid} from '../palette/color-swatch-grid.js';
import {ColorPickerDialog} from '../palette/color-picker-dialog.js';
import {WallpaperColorPicker} from '../palette/wallpaper-color-picker.js';
import {AppColorOverrides} from '../palette/AppColorOverrides.js';

/**
 * ColorPaletteSection - Manages the color palette display and editing
 * Handles color swatch grid, color picking, and per-app overrides
 */
export const ColorPaletteSection = GObject.registerClass(
    {
        Signals: {
            'color-changed': {param_types: [GObject.TYPE_INT, GObject.TYPE_STRING]},
            'overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class ColorPaletteSection extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
            });

            this._palette = [];
            this._currentWallpaper = null;
            this._appOverrides = {};

            this._buildUI();
        }

        _buildUI() {
            // Header with title and pick button
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
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

            // App color overrides (hidden by default)
            this._advancedGroup = new Adw.PreferencesGroup({
                margin_top: 12,
                visible: false,
            });
            this._appOverridesWidget = new AppColorOverrides();
            this._appOverridesWidget.connect('overrides-changed', (_, overrides) => {
                this._appOverrides = overrides;
                this.emit('overrides-changed', overrides);
            });
            this._advancedGroup.add(this._appOverridesWidget);
            this.append(this._advancedGroup);
        }

        _openColorPicker(index, currentColor, swatch) {
            const dialog = new ColorPickerDialog(this.get_root(), this._palette);
            dialog.openShadePicker(index, currentColor, (color) => {
                this._palette[index] = color;
                this._swatchGrid.updateSwatchColor(index, color);
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
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            // Create color picker
            const colorPicker = new WallpaperColorPicker(this._currentWallpaper);
            content.append(colorPicker);

            // Handle color selection
            colorPicker.connect('color-picked', (_, color) => {
                // Find first unlocked color slot
                const lockedColors = this._swatchGrid.getLockedColors();
                const firstUnlocked = lockedColors.findIndex(locked => !locked);

                if (firstUnlocked !== -1) {
                    this._palette[firstUnlocked] = color;
                    this._swatchGrid.updateSwatchColor(firstUnlocked, color);
                    this.emit('color-changed', firstUnlocked, color);
                }

                dialog.close();
            });

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

        setAppOverridesVisible(visible) {
            this._advancedGroup.set_visible(visible);
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

        reset() {
            this._palette = [];
            this._currentWallpaper = null;
            this._swatchGrid.setLockedColors(new Array(16).fill(false));
        }
    }
);
