import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {extractColorsFromWallpaperIM} from '../utils/color-extraction.js';
import {adjustColor} from '../utils/color-utils.js';
import {ensureDirectoryExists} from '../utils/file-utils.js';
import {registerCustomIcons} from '../utils/ui-helpers.js';
import {WallpaperSection} from './palette-editor/WallpaperSection.js';
import {AdditionalImagesSection} from './palette-editor/AdditionalImagesSection.js';
import {ColorPaletteSection} from './palette-editor/ColorPaletteSection.js';
import {EmptyState} from './palette-editor/EmptyState.js';
import {SPACING} from '../constants/ui-constants.js';
import {themeState} from '../state/ThemeState.js';
import {SignalTracker} from '../utils/signal-tracker.js';

/**
 * PaletteEditor - Main component for palette creation and wallpaper management
 *
 * Primary interface for creating and managing color palettes from wallpapers.
 *
 * Features:
 * - Wallpaper selection and color extraction
 * - Color palette grid with 16 ANSI colors (editable)
 * - Lock colors to prevent adjustment changes
 * - Additional images management
 * - Integration with WallpaperEditor for filter application
 *
 * Sub-components:
 * - WallpaperSection: Wallpaper preview and actions
 * - ColorPaletteSection: 16-color grid with editing and locking
 * - AdditionalImagesSection: Manage additional theme images
 *
 * Signals:
 * - 'palette-generated' (palette: object) - Emitted when colors extracted
 * - 'adjustments-applied' (adjustments: object) - Color adjustments applied
 * - 'overrides-changed' (overrides: object) - Per-app overrides changed
 * - 'open-wallpaper-editor' (path: string) - Open wallpaper in editor
 * - 'apply-wallpaper' - Apply current wallpaper without extraction
 * - 'browse-wallhaven' - User wants to browse Wallhaven
 * - 'browse-local' - User wants to browse local wallpapers
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
            'browse-wallhaven': {},
            'browse-local': {},
        },
    },
    class PaletteEditor extends Gtk.Box {
        /**
         * Initializes PaletteEditor with all sub-components
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            // Signal tracker for cleanup
            this._signals = new SignalTracker();

            registerCustomIcons();

            // Local state references (synced with themeState)
            this._palette = themeState.getPalette();
            this._originalPalette = [...this._palette];
            this._lightMode = themeState.getLightMode();
            this._wallpaperMetadata = themeState.getWallpaperMetadata();
            this._currentWallpaper = themeState.getWallpaper();

            this._initializeUI();
            this._connectThemeState();
        }

        /**
         * Called when widget is removed from the widget tree
         * Cleans up all signal connections to prevent memory leaks
         */
        vfunc_unroot() {
            this._signals.disconnectAll();
            super.vfunc_unroot();
        }

        /**
         * Connect to centralized theme state signals
         * Uses SignalTracker for proper cleanup on destroy
         * @private
         */
        _connectThemeState() {
            // Listen for external palette changes (e.g., from blueprint loading)
            this._signals.track(themeState, 'palette-changed', (_, palette) => {
                // Only update if different (avoid loops)
                if (JSON.stringify(palette) !== JSON.stringify(this._palette)) {
                    this._palette = [...palette];
                    // Also update original palette as base for future adjustments
                    this._originalPalette = [...palette];
                    this._colorPalette.setPalette(palette);
                }
            });

            // Note: adjustments-changed from themeState is used to sync UI sliders only.
            // When loading blueprints, colors are already adjusted - no re-application needed.
            // When user moves sliders, adjustments are applied via applyAdjustments() call.

            // Listen for light mode changes
            this._signals.track(
                themeState,
                'light-mode-changed',
                (_, lightMode) => {
                    this._lightMode = lightMode;
                }
            );

            // Listen for wallpaper changes
            this._signals.track(
                themeState,
                'wallpaper-changed',
                (_, wallpaperPath) => {
                    if (
                        wallpaperPath &&
                        wallpaperPath !== this._currentWallpaper
                    ) {
                        this.loadWallpaper(
                            wallpaperPath,
                            themeState.getWallpaperMetadata()
                        );
                    }
                }
            );

            // Listen for state reset
            this._signals.track(themeState, 'state-reset', () => {
                this.reset();
            });
        }

        /**
         * Initializes UI components
         * @private
         */
        _initializeUI() {
            const viewBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_top: SPACING.MD,
                hexpand: true,
            });

            // Empty state
            this._emptyState = new EmptyState();
            this._emptyState.connect('wallpaper-uploaded', (_, path) => {
                this.loadWallpaper(path);
            });
            this._emptyState.connect('browse-wallhaven-clicked', () => {
                this.emit('browse-wallhaven');
            });
            this._emptyState.connect('browse-local-clicked', () => {
                this.emit('browse-local');
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
                // Update centralized state
                themeState.setColor(index, color);
                this.emit('palette-generated', this._palette);
            });
            this._colorPalette.connect('overrides-changed', (_, overrides) => {
                this.emit('overrides-changed', overrides);
            });
            this._colorPalette.connect('palette-imported', (_, data) => {
                // Update internal state with imported palette
                this._palette = [...data.colors];
                this._originalPalette = [...data.colors];
                this.emit('palette-generated', this._palette);
            });
            viewBox.append(this._colorPalette);

            this.append(viewBox);

            // Load default colors
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultColors();
                return GLib.SOURCE_REMOVE;
            });
        }

        /**
         * Loads wallpaper into the editor
         * Hides empty state and updates wallpaper section and color palette
         * @param {string} path - Path to wallpaper file
         * @param {Object} [metadata] - Optional wallpaper metadata (url, source)
         * @public
         */
        loadWallpaper(path, metadata = null) {
            this._currentWallpaper = path;
            this._emptyState.set_visible(false);
            this._wallpaperSection.loadWallpaper(path);
            this._colorPalette.setWallpaper(path);
            this._wallpaperMetadata = metadata;
            // Update centralized state
            themeState.setWallpaper(path, metadata);
        }

        /**
         * Sets wallpaper metadata (for wallhaven wallpapers)
         * @param {Object} metadata - Metadata object with url and source
         * @public
         */
        setWallpaperMetadata(metadata) {
            this._wallpaperMetadata = metadata;
        }

        /**
         * Adds a wallhaven image to additional images
         * @param {Object} wallpaper - Wallpaper object from wallhaven
         * @public
         */
        addWallhavenImage(wallpaper) {
            this._additionalImages.addWallhavenImage(wallpaper);
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
         * @param {Object} [options] - Options
         * @param {boolean} [options.updateState=true] - Whether to update themeState
         * @public
         */
        setPalette(colors, {updateState = true} = {}) {
            this._palette = [...colors];
            this._colorPalette.setPalette(colors);
            // Update centralized state (unless called from state listener)
            if (updateState) {
                themeState.setPalette(colors, {silent: true});
            }
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
         * @public
         */
        applyAdjustments(values) {
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

        /**
         * Resets adjustments and restores original palette
         * @public
         */
        resetAdjustments() {
            if (this._originalPalette.length > 0) {
                this.setPalette([...this._originalPalette]);
            }
        }

        // No-op methods kept for backwards compatibility
        switchToEditorTab() {}
        switchToCustomTab() {}

        async loadBlueprintPalette(palette) {
            if (palette.colors) {
                this._originalPalette = [...palette.colors];
                this.setPalette(palette.colors);
            }

            // Handle wallpaper loading
            if (palette.wallpaperUrl && !palette.wallpaper) {
                await this._downloadAndLoadWallpaper(palette);
            } else if (palette.wallpaper) {
                this.loadWallpaperWithoutExtraction(palette.wallpaper);
                if (palette.wallpaperUrl) {
                    this._wallpaperMetadata = {
                        url: palette.wallpaperUrl,
                        source: palette.wallpaperSource || 'wallhaven',
                    };
                }
            }

            // Load additional images
            if (Array.isArray(palette.additionalImages)) {
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

        async _downloadAndLoadWallpaper(palette) {
            try {
                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);
                ensureDirectoryExists(wallpapersDir);

                const urlParts = palette.wallpaperUrl.split('/');
                const filename =
                    urlParts[urlParts.length - 1] || 'imported-wallpaper.jpg';
                const wallpaperPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);

                const file = Gio.File.new_for_path(wallpaperPath);
                if (!file.query_exists(null)) {
                    const {wallhavenService} = await import(
                        '../services/wallhaven-service.js'
                    );
                    await wallhavenService.downloadWallpaper(
                        palette.wallpaperUrl,
                        wallpaperPath
                    );
                }

                this.loadWallpaperWithoutExtraction(wallpaperPath);
                this._wallpaperMetadata = {
                    url: palette.wallpaperUrl,
                    source: palette.wallpaperSource || 'wallhaven',
                };
            } catch (error) {
                console.error('Failed to download wallpaper from URL:', error);
            }
        }

        setLightMode(lightMode) {
            this._lightMode = lightMode;
            themeState.setLightMode(lightMode);
        }

        getLightMode() {
            return this._lightMode;
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
            this._currentWallpaper = null;
            this._wallpaperSection.reset();
            this._additionalImages.reset();
            this._colorPalette.reset();
            this._emptyState.set_visible(true);
            this._loadDefaultColors();
            // Reset centralized state
            themeState.reset();
        }
    }
);

// Alias for backward compatibility
export const PaletteGenerator = PaletteEditor;
