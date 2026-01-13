import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {extractColorsFromWallpaperIM} from '../utils/imagemagick-color-extraction.js';
import {adjustColor} from '../utils/color-utils.js';
import {ensureDirectoryExists} from '../utils/file-utils.js';
import {applyCssToWidget, registerCustomIcons} from '../utils/ui-helpers.js';
import {HeroEmptyState} from './palette-editor/HeroEmptyState.js';
import {WallpaperHero} from './palette-editor/WallpaperHero.js';
import {ColorPaletteDisplay} from './palette-editor/ColorPaletteDisplay.js';
import {AdditionalImagesSection} from './palette-editor/AdditionalImagesSection.js';
import {ColorPickerDialog} from './palette/color-picker-dialog.js';
import {AppColorOverrides} from './palette/AppColorOverrides.js';
import {SPACING} from '../constants/ui-constants.js';
import {themeState} from '../state/ThemeState.js';

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

            // Color palette section
            this._colorPalette = new ColorPaletteDisplay();
            this._colorPalette.connect('color-clicked', (_, index, color) => {
                this._openColorPicker(index, color);
            });
            this._colorPalette.connect('color-locked', (_, index, locked) => {
                // Lock state is managed internally
            });
            this._editorContent.append(this._colorPalette);

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
                this.emit('palette-generated', this._palette);
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
                    this.setPalette(mergedColors);
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

        setPalette(colors, {updateState = true} = {}) {
            this._palette = [...colors];
            this._colorPalette.setPalette(colors);

            if (updateState) {
                themeState.setPalette(colors, {silent: true});
            }
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

        async loadBlueprintPalette(palette) {
            if (palette.colors) {
                this._originalPalette = [...palette.colors];
                this.setPalette(palette.colors);
            }

            if (palette.wallpaperUrl && !palette.wallpaper) {
                try {
                    const wallpapersDir = GLib.build_filenamev([
                        GLib.get_user_data_dir(),
                        'aether',
                        'wallpapers',
                    ]);
                    ensureDirectoryExists(wallpapersDir);

                    const urlParts = palette.wallpaperUrl.split('/');
                    const filename =
                        urlParts[urlParts.length - 1] ||
                        'imported-wallpaper.jpg';
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
                    console.error(
                        'Failed to download wallpaper from URL:',
                        error
                    );
                }
            } else if (palette.wallpaper) {
                this.loadWallpaperWithoutExtraction(palette.wallpaper);

                if (palette.wallpaperUrl) {
                    this._wallpaperMetadata = {
                        url: palette.wallpaperUrl,
                        source: palette.wallpaperSource || 'wallhaven',
                    };
                }
            }

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
                this._appOverridesWidget.loadFromBlueprint(palette.appOverrides);
            }

            this._colorPalette.setLockedColors(new Array(16).fill(false));
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

        getPalette() {
            return {
                wallpaper: this._currentWallpaper,
                wallpaperUrl: this._wallpaperMetadata?.url || null,
                wallpaperSource: this._wallpaperMetadata?.source || 'local',
                colors: this._palette,
                lightMode: this._lightMode,
                appOverrides: this._appOverridesWidget.getOverrides
                    ? this._appOverridesWidget.getOverrides()
                    : {},
                additionalImages: this._additionalImages.getImages(),
            };
        }

        getAdditionalImages() {
            return this._additionalImages.getImages();
        }

        getAppOverrides() {
            return this._appOverridesWidget.getOverrides
                ? this._appOverridesWidget.getOverrides()
                : {};
        }

        updateAppOverrideColors(colors) {
            if (this._appOverridesWidget?.setPaletteColors) {
                this._appOverridesWidget.setPaletteColors(colors);
            }
        }

        setNeovimThemeSelected(selected) {
            if (this._appOverridesWidget?.setNeovimThemeSelected) {
                this._appOverridesWidget.setNeovimThemeSelected(selected);
            }
        }

        // Compatibility methods
        switchToEditorTab() {}
        switchToCustomTab() {}

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
