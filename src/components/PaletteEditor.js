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
 *
 * Primary interface for creating and managing color palettes from wallpapers.
 * Orchestrates multiple sub-components in a tabbed interface:
 *
 * Features:
 * - Tab 1 (Editor): Wallpaper selection, color extraction, palette editing
 * - Tab 2 (Wallhaven): Online wallpaper browser from wallhaven.cc
 * - Tab 3 (Local): Browse wallpapers from ~/Wallpapers directory
 * - Tab 4 (Favorites): Quick access to favorited wallpapers
 * - Color palette grid with 16 ANSI colors (editable)
 * - Lock colors to prevent adjustment changes
 * - Additional images management
 * - Integration with WallpaperEditor for filter application
 *
 * Sub-components:
 * - WallpaperSection: Wallpaper preview and actions
 * - ColorPaletteSection: 16-color grid with editing and locking
 * - AdditionalImagesSection: Manage additional theme images
 * - TabNavigation: Unified tab navigation component
 * - WallpaperBrowser: Wallhaven.cc integration
 * - LocalWallpaperBrowser: Local file system browser
 * - FavoritesView: Favorited wallpapers display
 *
 * Signals:
 * - 'palette-generated' (palette: object) - Emitted when colors extracted
 * - 'adjustments-applied' (adjustments: object) - Color adjustments applied
 * - 'overrides-changed' (overrides: object) - Per-app overrides changed
 * - 'open-wallpaper-editor' (path: string) - Open wallpaper in editor
 * - 'apply-wallpaper' - Apply current wallpaper without extraction
 *
 * @class PaletteEditor
 * @extends {Gtk.Box}
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
        /**
         * Initializes PaletteEditor with all sub-components
         * Sets up tab navigation, wallpaper browsers, and palette editing
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            registerCustomIcons();

            this._palette = [];
            this._originalPalette = [];
            this._lightMode = false;
            this._wallpaperMetadata = null; // Store wallpaper URL and source

            this._initializeUI();
        }

        /**
         * Initializes all UI components and tab navigation
         * Sets up 4 tabs: Editor, Wallhaven, Local, Favorites
         * Connects signal handlers for wallpaper selection
         * @private
         */
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
            this._wallhavenBrowser.connect(
                'wallpaper-selected',
                (_, path, metadata) => {
                    this._onBrowserWallpaperSelected(path, metadata);
                }
            );
            this._wallhavenBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._wallhavenBrowser.connect(
                'add-to-additional-images',
                (_, wallpaper) => {
                    this._additionalImages.addWallhavenImage(wallpaper);
                }
            );
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
            this._localBrowser.connect(
                'add-to-additional-images',
                (_, wallpaper) => {
                    this._additionalImages.addImage(wallpaper.path);
                }
            );
            this._viewStack.add_named(this._localBrowser, 'local');

            // Favorites view
            this._favoritesView = new FavoritesView();
            this._favoritesView.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._favoritesView.connect(
                'add-to-additional-images',
                (_, wallpaper) => {
                    // For wallhaven type, use addWallhavenImage, for local use addImage
                    if (wallpaper.type === 'wallhaven') {
                        this._additionalImages.addWallhavenImage(wallpaper);
                    } else {
                        this._additionalImages.addImage(wallpaper.path);
                    }
                }
            );
            this._viewStack.add_named(this._favoritesView, 'favorites');

            this.append(this._viewStack);

            // Load default colors and favorites
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultColors();
                this._favoritesView.loadFavorites();
                return GLib.SOURCE_REMOVE;
            });
        }

        /**
         * Creates the main editor view tab
         * Contains wallpaper section, additional images, and color palette
         * @returns {Gtk.Box} Editor view widget
         * @private
         */
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
            this._emptyState.connect('browse-wallhaven-clicked', () => {
                this._tabNavigation.setActiveTab('wallhaven');
                this._viewStack.set_visible_child_name('wallhaven');
            });
            this._emptyState.connect('browse-local-clicked', () => {
                this._tabNavigation.setActiveTab('local');
                this._viewStack.set_visible_child_name('local');
            });
            viewBox.append(this._emptyState);

            // Wallpaper section
            this._wallpaperSection = new WallpaperSection();
            this._wallpaperSection.connect('extract-clicked', (_, mode) => {
                const wallpaper = this._wallpaperSection.getCurrentWallpaper();
                if (wallpaper) {
                    this._extractColors(wallpaper, mode);
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

        /**
         * Handles wallpaper selection from browsers (Wallhaven, Local, Favorites)
         * Switches to editor tab and loads the selected wallpaper
         * @param {string} path - Path to selected wallpaper
         * @param {Object} [metadata] - Optional wallpaper metadata (url, source)
         * @private
         */
        _onBrowserWallpaperSelected(path, metadata = null) {
            this._tabNavigation.setActiveTab('editor');
            this._viewStack.set_visible_child_name('editor');
            this.loadWallpaper(path, metadata);
        }

        /**
         * Loads wallpaper into the editor
         * Hides empty state and updates wallpaper section and color palette
         * @param {string} path - Path to wallpaper file
         * @param {Object} [metadata] - Optional wallpaper metadata (url, source)
         * @public
         */
        loadWallpaper(path, metadata = null) {
            this._emptyState.set_visible(false);
            this._wallpaperSection.loadWallpaper(path);
            this._colorPalette.setWallpaper(path);
            this._wallpaperMetadata = metadata;
        }

        /**
         * Loads wallpaper without triggering color extraction
         * Useful when applying saved blueprints
         * @param {string} path - Path to wallpaper file
         * @public
         */
        loadWallpaperWithoutExtraction(path) {
            this.loadWallpaper(path);
        }

        /**
         * Extracts colors from wallpaper using ImageMagick
         * Respects locked colors and merges with current palette
         * @param {string} imagePath - Path to wallpaper image
         * @param {string} [extractionMode='normal'] - Extraction mode
         * @private
         */
        _extractColors(imagePath, extractionMode = 'normal') {
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
                },
                extractionMode
            );
        }

        /**
         * Loads default Catppuccin-inspired color palette
         * Called on initial load when no wallpaper is selected
         * @private
         */
        _loadDefaultColors() {
            const defaultColors = [
                '#1e1e2e',
                '#f38ba8',
                '#a6e3a1',
                '#f9e2af',
                '#89b4fa',
                '#cba6f7',
                '#94e2d5',
                '#cdd6f4',
                '#45475a',
                '#f38ba8',
                '#a6e3a1',
                '#f9e2af',
                '#89b4fa',
                '#cba6f7',
                '#94e2d5',
                '#ffffff',
            ];

            this._originalPalette = [...defaultColors];
            this.setPalette(defaultColors);
        }

        /**
         * Sets the current color palette
         * Updates internal state and color palette section
         * @param {string[]} colors - Array of 16 hex colors
         * @public
         */
        setPalette(colors) {
            this._palette = [...colors];
            this._colorPalette.setPalette(colors);
        }

        /**
         * Applies a color preset to the palette
         * Used by SettingsSidebar preset library
         * @param {Object} preset - Preset object with colors array
         * @param {string[]} preset.colors - Array of 16 hex colors
         * @public
         */
        applyPreset(preset) {
            this._originalPalette = [...preset.colors];
            this.setPalette(preset.colors);
            this.emit('palette-generated', preset.colors);
        }

        /**
         * Applies color harmony (complementary, triadic, etc.)
         * Used by SettingsSidebar color harmony generator
         * @param {string[]} colors - Array of 16 hex colors
         * @public
         */
        applyHarmony(colors) {
            this._originalPalette = [...colors];
            this.setPalette(colors);
            this.emit('palette-generated', colors);
        }

        /**
         * Applies color adjustments to the palette
         * Respects locked colors and only adjusts unlocked ones
         * @param {Object} values - Adjustment values
         * @param {number} values.vibrance - Vibrance adjustment (-100 to 100)
         * @param {number} values.contrast - Contrast adjustment (-100 to 100)
         * @param {number} values.brightness - Brightness adjustment (-100 to 100)
         * @param {number} values.hueShift - Hue shift (0 to 360)
         * @param {number} values.temperature - Temperature adjustment (-100 to 100)
         * @param {number} values.gamma - Gamma adjustment (0.1 to 3.0)
         * @private
         */
        _applyAdjustments(values) {
            if (this._originalPalette.length === 0) return;

            const lockedColors = this._colorPalette.getLockedColors();

            const adjustedColors = this._originalPalette.map((color, index) => {
                if (lockedColors[index]) {
                    return this._palette[index];
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
            this.emit('adjustments-applied', adjustedColors);
        }

        resetAdjustments() {
            if (this._originalPalette.length > 0) {
                this.setPalette([...this._originalPalette]);
            }
        }

        switchToEditorTab() {
            if (this._viewStack) {
                this._viewStack.set_visible_child_name('editor');
            }
            if (this._tabNavigation) {
                this._tabNavigation.setActiveTab('editor');
            }
        }

        // Kept for backwards compatibility
        switchToCustomTab() {
            this.switchToEditorTab();
        }

        loadBlueprintPalette(palette) {
            if (palette.colors) {
                this._originalPalette = [...palette.colors];
                this.setPalette(palette.colors);
            }

            if (palette.wallpaper) {
                this.loadWallpaperWithoutExtraction(palette.wallpaper);
            }

            // Always reset additional images when loading blueprint
            // Then load blueprint's images if they exist
            if (
                palette.additionalImages &&
                Array.isArray(palette.additionalImages)
            ) {
                this._additionalImages.setImages(palette.additionalImages);
            } else {
                this._additionalImages.reset();
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
                wallpaperUrl: this._wallpaperMetadata?.url || null,
                wallpaperSource: this._wallpaperMetadata?.source || 'local',
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
