import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {extractColorsFromWallpaperIM} from '../utils/imagemagick-color-extraction.js';
import {adjustColor} from '../utils/color-utils.js';
import {WallpaperBrowser} from './WallpaperBrowser.js';
import {LocalWallpaperBrowser} from './LocalWallpaperBrowser.js';
import {FavoritesView} from './FavoritesView.js';
import {registerCustomIcons} from '../utils/icon-utils.js';
import {WallpaperSection} from './palette-editor/WallpaperSection.js';
import {AdditionalImagesSection} from './palette-editor/AdditionalImagesSection.js';
import {ColorPaletteSection} from './palette-editor/ColorPaletteSection.js';
import {TabNavigation} from './palette-editor/TabNavigation.js';
import {EmptyState} from './palette-editor/EmptyState.js';

/**
 * PaletteEditor - Main component for palette creation and wallpaper management
 * Orchestrates all sub-components (wallpaper, colors, images, tabs)
 */
export const PaletteEditor = GObject.registerClass(
    {
        Signals: {
            'palette-generated': {param_types: [GObject.TYPE_JSOBJECT]},
            'adjustments-applied': {param_types: [GObject.TYPE_JSOBJECT]},
            'overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'open-wallpaper-editor': {param_types: [GObject.TYPE_STRING]},
            'apply-wallpaper': {},
        },
    },
    class PaletteEditor extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            registerCustomIcons();

            this._palette = [];
            this._originalPalette = [];
            this._lightMode = false;

            this._initializeUI();
        }

        _initializeUI() {
            // Tab navigation
            this._tabNavigation = new TabNavigation();
            this._tabNavigation.connect('tab-changed', (_, tabName) => {
                this._viewStack.set_visible_child_name(tabName);
            });

            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });
            headerBox.append(this._tabNavigation);
            this.append(headerBox);

            // View stack for tabs
            this._viewStack = new Adw.ViewStack();

            // Editor tab
            const editorView = this._createEditorView();
            this._viewStack.add_named(editorView, 'editor');

            // Wallhaven browser
            this._wallhavenBrowser = new WallpaperBrowser();
            this._wallhavenBrowser.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._wallhavenBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._viewStack.add_named(this._wallhavenBrowser, 'wallhaven');

            // Local browser
            this._localBrowser = new LocalWallpaperBrowser();
            this._localBrowser.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._localBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._viewStack.add_named(this._localBrowser, 'local');

            // Favorites view
            this._favoritesView = new FavoritesView();
            this._favoritesView.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._viewStack.add_named(this._favoritesView, 'favorites');

            this.append(this._viewStack);

            // Load default colors
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultColors();
                return GLib.SOURCE_REMOVE;
            });
        }

        _createEditorView() {
            const viewBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                hexpand: true,
            });

            // Empty state
            this._emptyState = new EmptyState();
            this._emptyState.connect('wallpaper-uploaded', (_, path) => {
                this.loadWallpaper(path);
            });
            viewBox.append(this._emptyState);

            // Wallpaper section
            this._wallpaperSection = new WallpaperSection();
            this._wallpaperSection.connect('extract-clicked', () => {
                const wallpaper = this._wallpaperSection.getCurrentWallpaper();
                if (wallpaper) {
                    this._extractColors(wallpaper);
                }
            });
            this._wallpaperSection.connect('edit-clicked', () => {
                const wallpaper = this._wallpaperSection.getCurrentWallpaper();
                if (wallpaper) {
                    this.emit('open-wallpaper-editor', wallpaper);
                }
            });
            this._wallpaperSection.connect('apply-clicked', () => {
                this.emit('apply-wallpaper');
            });
            viewBox.append(this._wallpaperSection);

            // Additional images section
            this._additionalImages = new AdditionalImagesSection();
            viewBox.append(this._additionalImages);

            // Color palette section
            this._colorPalette = new ColorPaletteSection();
            this._colorPalette.connect('color-changed', (_, index, color) => {
                this._palette[index] = color;
                this._originalPalette[index] = color;
                this.emit('palette-generated', this._palette);
            });
            this._colorPalette.connect('overrides-changed', (_, overrides) => {
                this.emit('overrides-changed', overrides);
            });
            viewBox.append(this._colorPalette);

            return viewBox;
        }

        _onBrowserWallpaperSelected(path) {
            this._tabNavigation.setActiveTab('editor');
            this._viewStack.set_visible_child_name('editor');
            this.loadWallpaper(path);
        }

        loadWallpaper(path) {
            this._emptyState.set_visible(false);
            this._wallpaperSection.loadWallpaper(path);
            this._colorPalette.setWallpaper(path);
        }

        loadWallpaperWithoutExtraction(path) {
            this.loadWallpaper(path);
        }

        _extractColors(imagePath) {
            this._wallpaperSection.setLoading(true);

            const lockedColors = this._colorPalette.getLockedColors();
            const currentPalette = [...this._palette];

            extractColorsFromWallpaperIM(
                imagePath,
                this._lightMode,
                colors => {
                    const mergedColors = colors.map((color, index) => {
                        if (lockedColors[index] && currentPalette[index]) {
                            return currentPalette[index];
                        }
                        return color;
                    });

                    this._originalPalette = [...mergedColors];
                    this.setPalette(mergedColors);
                    this.emit('palette-generated', mergedColors);
                    this._wallpaperSection.setLoading(false);
                },
                error => {
                    console.error('Error extracting colors:', error.message);
                    this._wallpaperSection.setLoading(false);
                }
            );
        }

        _loadDefaultColors() {
            const defaultColors = [
                '#1e1e2e', '#f38ba8', '#a6e3a1', '#f9e2af',
                '#89b4fa', '#cba6f7', '#94e2d5', '#cdd6f4',
                '#45475a', '#f38ba8', '#a6e3a1', '#f9e2af',
                '#89b4fa', '#cba6f7', '#94e2d5', '#ffffff',
            ];

            this._originalPalette = [...defaultColors];
            this.setPalette(defaultColors);
        }

        setPalette(colors) {
            this._palette = [...colors];
            this._colorPalette.setPalette(colors);
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

            const lockedColors = this._colorPalette.getLockedColors();

            const adjustedColors = this._originalPalette.map((color, index) => {
                if (lockedColors[index]) {
                    return this._palette[index];
                }
                return adjustColor(color, values);
            });

            this.setPalette(adjustedColors);
            this.emit('adjustments-applied', adjustedColors);
        }

        resetAdjustments() {
            if (this._originalPalette.length > 0) {
                this.setPalette([...this._originalPalette]);
            }
        }

        loadBlueprintPalette(palette) {
            if (palette.colors) {
                this._originalPalette = [...palette.colors];
                this.setPalette(palette.colors);
            }

            if (palette.wallpaper) {
                this.loadWallpaperWithoutExtraction(palette.wallpaper);
            }

            if (palette.additionalImages && Array.isArray(palette.additionalImages)) {
                this._additionalImages.setImages(palette.additionalImages);
            }

            if (palette.lightMode !== undefined) {
                this._lightMode = palette.lightMode;
            }

            if (palette.appOverrides) {
                this._colorPalette.loadAppOverrides(palette.appOverrides);
            }

            this._colorPalette.setLockedColors(new Array(16).fill(false));
        }

        setLightMode(lightMode) {
            this._lightMode = lightMode;
        }

        getLightMode() {
            return this._lightMode;
        }

        setAppOverridesVisible(visible) {
            this._colorPalette.setAppOverridesVisible(visible);
        }

        resetAppOverrides() {
            this._colorPalette.resetAppOverrides();
        }

        getPalette() {
            return {
                wallpaper: this._wallpaperSection.getCurrentWallpaper(),
                colors: this._palette,
                lightMode: this._lightMode,
                appOverrides: this._colorPalette.getAppOverrides(),
                additionalImages: this._additionalImages.getImages(),
            };
        }

        getAdditionalImages() {
            return this._additionalImages.getImages();
        }

        getAppOverrides() {
            return this._colorPalette.getAppOverrides();
        }

        updateAppOverrideColors(colors) {
            this._colorPalette.updateAppOverridePaletteColors(colors);
        }

        setNeovimThemeSelected(selected) {
            this._colorPalette.setNeovimThemeSelected(selected);
        }

        reset() {
            this._wallpaperSection.reset();
            this._additionalImages.reset();
            this._colorPalette.reset();
            this._emptyState.set_visible(true);
            this._loadDefaultColors();
        }
    }
);

// Alias for backward compatibility
export const PaletteGenerator = PaletteEditor;
