import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {extractColorsFromWallpaperIM} from '../utils/color-extraction.js';
import {adjustColor} from '../utils/color-utils.js';
import {ensureDirectoryExists} from '../utils/file-utils.js';
import {applyCssToWidget, registerCustomIcons} from '../utils/ui-helpers.js';
import {HeroEmptyState} from './palette-editor/HeroEmptyState.js';
import {WallpaperHero} from './palette-editor/WallpaperHero.js';
import {ColorPaletteDisplay} from './palette-editor/ColorPaletteDisplay.js';
import {AdditionalImagesSection} from './palette-editor/AdditionalImagesSection.js';
import {ColorPickerDialog} from './palette/color-picker-dialog.js';
import {AppColorOverrides} from './palette/AppColorOverrides.js';
import {ExtendedColorControls} from './palette/ExtendedColorControls.js';
import {themeState} from '../state/ThemeState.js';
import {readFileAsText} from '../utils/file-utils.js';
import {parseBase16Yaml} from '../utils/base16-utils.js';
import {parseColorsToml} from '../utils/toml-utils.js';
import {showToast} from '../utils/ui-helpers.js';

/**
 * ThemeEditor - Redesigned main editor with sharp, modern aesthetics
 *
 * Features:
 * - Dramatic empty state with visual impact
 * - Hero wallpaper display with overlaid actions
 * - Clean color palette grid with lock functionality
 * - Streamlined additional images section
 */
export const ThemeEditor = GObject.registerClass(
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
    class ThemeEditor extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            registerCustomIcons();

            // State from centralized store
            this._palette = themeState.getPalette();
            this._originalPalette = [...this._palette];
            this._lightMode = themeState.getLightMode();
            this._wallpaperMetadata = themeState.getWallpaperMetadata();
            this._currentWallpaper = themeState.getWallpaper();

            this._buildUI();
            this._connectThemeState();
        }

        _connectThemeState() {
            themeState.connect('palette-changed', (_, palette) => {
                if (JSON.stringify(palette) !== JSON.stringify(this._palette)) {
                    this._palette = [...palette];
                    this._originalPalette = [...palette];
                    this._colorPalette.setPalette(palette);
                }
            });

            themeState.connect('light-mode-changed', (_, lightMode) => {
                this._lightMode = lightMode;
            });

            themeState.connect('wallpaper-changed', (_, wallpaperPath) => {
                if (wallpaperPath && wallpaperPath !== this._currentWallpaper) {
                    this.loadWallpaper(
                        wallpaperPath,
                        themeState.getWallpaperMetadata()
                    );
                }
            });

            themeState.connect('state-reset', () => {
                this.reset();
            });

            // Blueprint loaded: force full resync regardless of comparison guards
            themeState.connect('blueprint-loaded', () => {
                const palette = themeState.getPalette();
                this._palette = [...palette];
                this._originalPalette = [...palette];
                this._colorPalette.setPalette(palette);
                this._lightMode = themeState.getLightMode();

                // Update wallpaper if present
                const wallpaperPath = themeState.getWallpaper();
                if (wallpaperPath && wallpaperPath !== this._currentWallpaper) {
                    this.loadWallpaper(
                        wallpaperPath,
                        themeState.getWallpaperMetadata()
                    );
                }
            });
        }

        _buildUI() {
            // Main scrolled container
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
                hexpand: true,
            });

            // Content container
            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 24,
                margin_end: 24,
                vexpand: true,
                hexpand: true,
            });

            // Empty state (shown initially)
            this._emptyState = new HeroEmptyState();
            this._emptyState.connect('wallpaper-uploaded', (_, path) => {
                this.loadWallpaper(path);
            });
            this._emptyState.connect('browse-wallhaven-clicked', () => {
                this.emit('browse-wallhaven');
            });
            this._emptyState.connect('browse-local-clicked', () => {
                this.emit('browse-local');
            });
            content.append(this._emptyState);

            // Editor content (hidden initially)
            this._editorContent = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                visible: false,
            });

            // Wallpaper hero section
            this._wallpaperHero = new WallpaperHero();
            this._wallpaperHero.connect('extract-clicked', (_, mode) => {
                this._extractColors(
                    this._wallpaperHero.getCurrentWallpaper(),
                    mode
                );
            });
            this._wallpaperHero.connect('edit-clicked', () => {
                const wallpaper = this._wallpaperHero.getCurrentWallpaper();
                if (wallpaper) {
                    this.emit('open-wallpaper-editor', wallpaper);
                }
            });
            this._wallpaperHero.connect('apply-clicked', () => {
                this.emit('apply-wallpaper');
            });
            this._editorContent.append(this._wallpaperHero);

            // Color palette (has its own header)
            this._colorPalette = new ColorPaletteDisplay();
            this._colorPalette.connect('color-clicked', (_, index, color) => {
                this._openColorPicker(index, color);
            });
            this._colorPalette.connect('color-locked', (_, index, locked) => {
                // Lock state is managed internally
            });
            this._editorContent.append(this._colorPalette);

            // Extended color controls (accent, cursor, selection)
            this._extendedColors = new ExtendedColorControls();
            this._editorContent.append(this._extendedColors);

            // Additional images section
            this._additionalImages = new AdditionalImagesSection();
            this._editorContent.append(this._additionalImages);

            // App color overrides
            this._appOverridesSection = this._createAppOverridesSection();
            this._editorContent.append(this._appOverridesSection);

            content.append(this._editorContent);

            scrolled.set_child(content);
            this.append(scrolled);

            // Load default colors
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._loadDefaultColors();
                return GLib.SOURCE_REMOVE;
            });
        }

        _createAppOverridesSection() {
            const section = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            // Header
            const header = new Gtk.Label({
                label: 'App Color Overrides',
                xalign: 0,
            });
            applyCssToWidget(
                header,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.7;
                }
            `
            );
            section.append(header);

            // Overrides widget
            this._appOverridesWidget = new AppColorOverrides();
            this._appOverridesWidget.connect(
                'overrides-changed',
                (_, overrides) => {
                    themeState.setAppOverrides(overrides);
                    this.emit('overrides-changed', overrides);
                }
            );
            section.append(this._appOverridesWidget);

            return section;
        }

        _openColorPicker(index, currentColor) {
            const dialog = new ColorPickerDialog(
                this.get_root(),
                this._palette
            );
            dialog.openShadePicker(index, currentColor, color => {
                this._palette[index] = color;
                this._originalPalette[index] = color;
                this._colorPalette.updateColor(index, color);
                themeState.setColor(index, color);
            });
        }

        _extractColors(imagePath, extractionMode = 'normal') {
            if (!imagePath) return;

            this._wallpaperHero.setLoading(true);

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
                    // Reset extended colors so they auto-derive from new palette
                    this.setPalette(mergedColors, {resetExtended: true});
                    this.emit('palette-generated', mergedColors);
                    this._wallpaperHero.setLoading(false);
                },
                error => {
                    console.error('Error extracting colors:', error.message);
                    this._wallpaperHero.setLoading(false);
                },
                extractionMode
            );
        }

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

        loadWallpaper(path, metadata = null) {
            this._currentWallpaper = path;
            this._wallpaperMetadata = metadata;

            // Show editor, hide empty state
            this._emptyState.set_visible(false);
            this._editorContent.set_visible(true);

            // Load into wallpaper hero
            this._wallpaperHero.loadWallpaper(path);

            // Update centralized state
            themeState.setWallpaper(path, metadata);
        }

        loadWallpaperWithoutExtraction(path) {
            this.loadWallpaper(path);
        }

        setPalette(colors, {updateState = true, resetExtended = false} = {}) {
            this._palette = [...colors];
            this._colorPalette.setPalette(colors);

            if (updateState) {
                themeState.setPalette(colors, {silent: true, resetExtended});
            }
        }

        applyPreset(preset) {
            this._originalPalette = [...preset.colors];
            this.setPalette(preset.colors, {resetExtended: true});
            this.emit('palette-generated', preset.colors);
        }

        applyHarmony(colors) {
            this._originalPalette = [...colors];
            this.setPalette(colors, {resetExtended: true});
            this.emit('palette-generated', colors);
        }

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
                    values.gamma,
                    values.saturation,
                    values.shadows,
                    values.highlights,
                    values.tint,
                    values.blackPoint,
                    values.whitePoint
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

        addWallhavenImage(wallpaper) {
            this._additionalImages.addWallhavenImage(wallpaper);
        }

        setWallpaperMetadata(metadata) {
            this._wallpaperMetadata = metadata;
        }

        /**
         * Loads palette data from a blueprint
         * @param {Object} palette - Blueprint palette object
         */
        async loadBlueprintPalette(palette) {
            if (palette.colors) {
                this._originalPalette = [...palette.colors];
                this.setPalette(palette.colors);
            }

            await this._loadBlueprintWallpaper(palette);

            if (Array.isArray(palette.additionalImages)) {
                this._additionalImages.setImages(palette.additionalImages);
            } else {
                this._additionalImages.reset();
            }

            if (palette.lightMode !== undefined) {
                this._lightMode = palette.lightMode;
            }

            if (palette.appOverrides) {
                this._appOverridesWidget.loadFromBlueprint(palette.appOverrides);
            }

            this._colorPalette.setLockedColors(new Array(16).fill(false));
        }

        /**
         * Loads wallpaper from blueprint, downloading if needed
         * @private
         * @param {Object} palette - Blueprint palette object
         */
        async _loadBlueprintWallpaper(palette) {
            if (palette.wallpaperUrl && !palette.wallpaper) {
                const wallpaperPath = await this._downloadWallpaper(palette.wallpaperUrl);
                if (wallpaperPath) {
                    this.loadWallpaperWithoutExtraction(wallpaperPath);
                    this._wallpaperMetadata = {
                        url: palette.wallpaperUrl,
                        source: palette.wallpaperSource || 'wallhaven',
                    };
                }
                return;
            }

            if (!palette.wallpaper) return;

            this.loadWallpaperWithoutExtraction(palette.wallpaper);
            if (palette.wallpaperUrl) {
                this._wallpaperMetadata = {
                    url: palette.wallpaperUrl,
                    source: palette.wallpaperSource || 'wallhaven',
                };
            }
        }

        /**
         * Downloads a wallpaper from URL
         * @private
         * @param {string} url - Wallpaper URL
         * @returns {Promise<string|null>} Local path or null on failure
         */
        async _downloadWallpaper(url) {
            try {
                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);
                ensureDirectoryExists(wallpapersDir);

                const urlParts = url.split('/');
                const filename = urlParts[urlParts.length - 1] || 'imported-wallpaper.jpg';
                const wallpaperPath = GLib.build_filenamev([wallpapersDir, filename]);

                const file = Gio.File.new_for_path(wallpaperPath);
                if (file.query_exists(null)) {
                    return wallpaperPath;
                }

                const {wallhavenService} = await import('../services/wallhaven-service.js');
                await wallhavenService.downloadWallpaper(url, wallpaperPath);
                return wallpaperPath;
            } catch (error) {
                console.error('Failed to download wallpaper from URL:', error);
                return null;
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
            this._appOverridesWidget.resetAllOverrides();
        }

        /**
         * Gets the current palette state for blueprint export
         * @returns {Object} Palette state object
         */
        getPalette() {
            return {
                wallpaper: this._currentWallpaper,
                wallpaperUrl: this._wallpaperMetadata?.url || null,
                wallpaperSource: this._wallpaperMetadata?.source || 'local',
                colors: this._palette,
                lightMode: this._lightMode,
                appOverrides: this.getAppOverrides(),
                additionalImages: this._additionalImages.getImages(),
            };
        }

        getAdditionalImages() {
            return this._additionalImages.getImages();
        }

        getAppOverrides() {
            return this._appOverridesWidget?.getOverrides?.() || {};
        }

        updateAppOverrideColors(colors) {
            this._appOverridesWidget?.setPaletteColors?.(colors);
        }

        setNeovimThemeSelected(selected) {
            this._appOverridesWidget?.setNeovimThemeSelected?.(selected);
        }

        // Compatibility methods
        switchToEditorTab() {}
        switchToCustomTab() {}

        /**
         * Opens file dialog to import Base16 color scheme
         * @private
         */
        _importBase16() {
            this._openFileDialog(
                'Import Base16 Color Scheme',
                {name: 'Base16 YAML Files', patterns: ['*.yaml', '*.yml']},
                filePath => this._processBase16File(filePath)
            );
        }

        /**
         * Opens file dialog to import colors.toml color scheme
         * @private
         */
        _importColorsToml() {
            this._openFileDialog(
                'Import Colors TOML',
                {name: 'TOML Files', patterns: ['*.toml']},
                filePath => this._processColorsTomlFile(filePath)
            );
        }

        /**
         * Opens a file dialog with the given configuration
         * @private
         * @param {string} title - Dialog title
         * @param {Object} filterConfig - Filter configuration
         * @param {string} filterConfig.name - Filter display name
         * @param {string[]} filterConfig.patterns - File patterns
         * @param {Function} onFileSelected - Callback when file is selected
         */
        _openFileDialog(title, filterConfig, onFileSelected) {
            const dialog = new Gtk.FileDialog({title});

            const filter = new Gtk.FileFilter();
            filter.set_name(filterConfig.name);
            filterConfig.patterns.forEach(pattern => filter.add_pattern(pattern));

            const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
            filterList.append(filter);
            dialog.set_filters(filterList);

            dialog.open(this.get_root(), null, (source, result) => {
                try {
                    const file = dialog.open_finish(result);
                    if (file) {
                        onFileSelected(file.get_path());
                    }
                } catch (e) {
                    if (!e.message.includes('Dismissed')) {
                        console.error('File picker error:', e.message);
                    }
                }
            });
        }

        /**
         * Processes and applies a Base16 YAML file
         * @private
         * @param {string} filePath - Path to the Base16 YAML file
         */
        _processBase16File(filePath) {
            try {
                const content = readFileAsText(filePath);
                const result = parseBase16Yaml(content);

                if (!result.colors || result.colors.length !== 16) return;

                this._applyImportedPalette(result.colors);
                showToast(this, `Imported: ${result.scheme}`);
            } catch (error) {
                console.error('Failed to import Base16 scheme:', error.message);
                showToast(this, `Import failed: ${error.message}`, 4);
            }
        }

        /**
         * Processes and applies a colors.toml file
         * @private
         * @param {string} filePath - Path to the colors.toml file
         */
        _processColorsTomlFile(filePath) {
            try {
                const content = readFileAsText(filePath);
                const result = parseColorsToml(content);

                if (!result.colors || result.colors.length !== 16) return;

                this._applyImportedPalette(result.colors);

                if (result.extendedColors && Object.keys(result.extendedColors).length > 0) {
                    themeState.setExtendedColors(result.extendedColors);
                }

                showToast(this, 'Imported colors.toml successfully');
            } catch (error) {
                console.error('Failed to import colors.toml:', error.message);
                showToast(this, `Import failed: ${error.message}`, 4);
            }
        }

        /**
         * Applies an imported palette to the UI and state
         * @private
         * @param {string[]} colors - Array of 16 hex colors
         */
        _applyImportedPalette(colors) {
            this._originalPalette = [...colors];
            this.setPalette(colors, {resetExtended: true});
            this.emit('palette-generated', colors);
        }

        reset() {
            this._currentWallpaper = null;
            this._wallpaperMetadata = null;
            this._wallpaperHero.reset();
            this._additionalImages.reset();
            this._colorPalette.reset();
            this._emptyState.set_visible(true);
            this._editorContent.set_visible(false);
            this._loadDefaultColors();
            themeState.reset();
        }
    }
);

// Alias for backward compatibility
export const PaletteEditor = ThemeEditor;
export const PaletteGenerator = ThemeEditor;
