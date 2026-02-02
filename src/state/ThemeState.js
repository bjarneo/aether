/**
 * ThemeState - Centralized state management for Aether
 *
 * Provides a single source of truth for theme-related state,
 * reducing component coupling and simplifying state synchronization.
 *
 * @module ThemeState
 */

import GObject from 'gi://GObject';

import {DEFAULT_PALETTE} from '../constants/colors.js';
import {HistoryManager} from './HistoryManager.js';

/**
 * @typedef {Object} ColorRoles
 * @property {string} background - Background color (hex)
 * @property {string} foreground - Foreground color (hex)
 * @property {string} color0 - ANSI color 0 (hex)
 * @property {string} color1 - ANSI color 1 (hex)
 * @property {string} color2 - ANSI color 2 (hex)
 * @property {string} color3 - ANSI color 3 (hex)
 * @property {string} color4 - ANSI color 4 (hex)
 * @property {string} color5 - ANSI color 5 (hex)
 * @property {string} color6 - ANSI color 6 (hex)
 * @property {string} color7 - ANSI color 7 (hex)
 * @property {string} color8 - ANSI color 8 (hex)
 * @property {string} color9 - ANSI color 9 (hex)
 * @property {string} color10 - ANSI color 10 (hex)
 * @property {string} color11 - ANSI color 11 (hex)
 * @property {string} color12 - ANSI color 12 (hex)
 * @property {string} color13 - ANSI color 13 (hex)
 * @property {string} color14 - ANSI color 14 (hex)
 * @property {string} color15 - ANSI color 15 (hex)
 */

/**
 * @typedef {Object} Adjustments
 * @property {number} vibrance - Vibrance adjustment (-100 to 100)
 * @property {number} saturation - Saturation adjustment (-100 to 100)
 * @property {number} contrast - Contrast adjustment (-100 to 100)
 * @property {number} brightness - Brightness adjustment (-100 to 100)
 * @property {number} shadows - Shadow adjustment (-50 to 50, affects L < 30%)
 * @property {number} highlights - Highlight adjustment (-50 to 50, affects L > 70%)
 * @property {number} hueShift - Hue shift adjustment (0 to 360)
 * @property {number} temperature - Temperature adjustment (-100 to 100)
 * @property {number} tint - Tint adjustment (-50 to 50, magenta to green)
 * @property {number} blackPoint - Black point adjustment (-30 to 30)
 * @property {number} whitePoint - White point adjustment (-30 to 30)
 * @property {number} gamma - Gamma adjustment (0.1 to 3.0)
 */

/**
 * @typedef {Object} AppOverrides
 * @property {Object.<string, ColorRoles>} [appName] - Per-app color overrides
 */

/**
 * Default adjustment values
 * @constant {Adjustments}
 */
const DEFAULT_ADJUSTMENTS = {
    vibrance: 0,
    saturation: 0,
    contrast: 0,
    brightness: 0,
    shadows: 0,
    highlights: 0,
    hueShift: 0,
    temperature: 0,
    tint: 0,
    blackPoint: 0,
    whitePoint: 0,
    gamma: 1.0,
};

/**
 * ThemeState - Centralized state store for theme data
 *
 * Emits signals when state changes, allowing components to react.
 *
 * @class
 * @extends {GObject.Object}
 *
 * @fires ThemeState#palette-changed - When palette colors change
 * @fires ThemeState#wallpaper-changed - When wallpaper path changes
 * @fires ThemeState#adjustments-changed - When adjustment values change
 * @fires ThemeState#light-mode-changed - When light mode toggles
 * @fires ThemeState#color-roles-changed - When color role assignments change
 * @fires ThemeState#app-overrides-changed - When per-app overrides change
 * @fires ThemeState#neovim-theme-changed - When Neovim theme selection changes
 * @fires ThemeState#state-reset - When state is fully reset
 * @fires ThemeState#blueprint-loaded - When a blueprint is loaded (forces UI resync)
 */
export const ThemeState = GObject.registerClass(
    {
        Signals: {
            'palette-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'wallpaper-changed': {param_types: [GObject.TYPE_STRING]},
            'adjustments-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'light-mode-changed': {param_types: [GObject.TYPE_BOOLEAN]},
            'color-roles-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'app-overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
            'neovim-theme-changed': {param_types: [GObject.TYPE_STRING]},
            'state-reset': {},
            'history-changed': {},
            'blueprint-loaded': {},
        },
    },
    class ThemeState extends GObject.Object {
        /**
         * Initialize state with default values
         */
        _init() {
            super._init();

            /** @private @type {string[]} */
            this._palette = [...DEFAULT_PALETTE];

            /** @private @type {boolean[]} */
            this._lockedColors = new Array(16).fill(false);

            /** @private @type {string|null} */
            this._wallpaper = null;

            /** @private @type {Object|null} */
            this._wallpaperMetadata = null;

            /** @private @type {boolean} */
            this._lightMode = false;

            /** @private @type {Adjustments} */
            this._adjustments = {...DEFAULT_ADJUSTMENTS};

            /** @private @type {ColorRoles} */
            this._colorRoles = this._createDefaultColorRoles();

            /** @private @type {AppOverrides} */
            this._appOverrides = {};

            /** @private @type {string|null} */
            this._neovimTheme = null;

            /** @private @type {string[]} */
            this._additionalImages = [];

            /** @private @type {Object} Extended color overrides (accent, cursor, selection_*) */
            this._extendedColors = {};

            /** @private @type {HistoryManager} */
            this._historyManager = new HistoryManager();
            this._historyManager.connect('history-changed', () => {
                this.emit('history-changed');
            });

            /** @private @type {boolean} Flag to prevent history capture during restore */
            this._isRestoring = false;
        }

        // ==================== Palette ====================

        /**
         * Get current palette colors
         * @returns {string[]} Array of 16 hex color strings
         */
        getPalette() {
            return [...this._palette];
        }

        /**
         * Set palette colors
         * @param {string[]} colors - Array of 16 hex color strings
         * @param {Object} [options] - Options
         * @param {boolean} [options.silent=false] - Skip signal emission
         * @param {boolean} [options.resetExtended=false] - Reset extended colors to auto-derive from palette
         */
        setPalette(colors, {silent = false, resetExtended = false} = {}) {
            if (!Array.isArray(colors) || colors.length !== 16) {
                console.error('Invalid palette: must be array of 16 colors');
                return;
            }

            if (!silent) {
                this._captureBeforeState();
            }

            this._palette = [...colors];

            // Reset extended colors so they auto-derive from new palette
            if (resetExtended) {
                this._extendedColors = {};
            }

            this._updateColorRolesFromPalette();

            if (!silent) {
                this.emit('palette-changed', this._palette);
                this._captureSnapshot('Set palette');
            }
        }

        /**
         * Set a single color in the palette
         * @param {number} index - Color index (0-15)
         * @param {string} color - Hex color string
         */
        setColor(index, color) {
            if (index < 0 || index > 15) return;

            this._captureBeforeState();
            this._palette[index] = color;
            this._updateColorRolesFromPalette();
            this.emit('palette-changed', this._palette);
            this._captureSnapshot(`Set color ${index}`);
        }

        // ==================== Color Locks ====================

        /**
         * Get locked state for all colors
         * @returns {boolean[]} Array of 16 lock states
         */
        getLockedColors() {
            return [...this._lockedColors];
        }

        /**
         * Set locked state for a color
         * @param {number} index - Color index (0-15)
         * @param {boolean} locked - Lock state
         */
        setColorLocked(index, locked) {
            if (index < 0 || index > 15) return;
            this._lockedColors[index] = locked;
        }

        /**
         * Check if a color is locked
         * @param {number} index - Color index (0-15)
         * @returns {boolean} Whether color is locked
         */
        isColorLocked(index) {
            return this._lockedColors[index] ?? false;
        }

        /**
         * Reset all locks
         */
        resetLocks() {
            this._lockedColors = new Array(16).fill(false);
        }

        // ==================== Wallpaper ====================

        /**
         * Get current wallpaper path
         * @returns {string|null} Wallpaper path or null
         */
        getWallpaper() {
            return this._wallpaper;
        }

        /**
         * Set wallpaper path
         * @param {string|null} path - Wallpaper path
         * @param {Object} [metadata] - Optional wallpaper metadata
         */
        setWallpaper(path, metadata = null) {
            this._wallpaper = path;
            this._wallpaperMetadata = metadata;
            this.emit('wallpaper-changed', path || '');
        }

        /**
         * Get wallpaper metadata
         * @returns {Object|null} Metadata or null
         */
        getWallpaperMetadata() {
            return this._wallpaperMetadata;
        }

        // ==================== Light Mode ====================

        /**
         * Get light mode state
         * @returns {boolean} Whether light mode is enabled
         */
        getLightMode() {
            return this._lightMode;
        }

        /**
         * Set light mode state
         * @param {boolean} enabled - Light mode enabled
         */
        setLightMode(enabled) {
            if (this._lightMode === enabled) return;

            this._captureBeforeState();
            this._lightMode = enabled;
            this.emit('light-mode-changed', enabled);
            this._captureSnapshot('Toggle light mode');
        }

        // ==================== Adjustments ====================

        /**
         * Get current adjustments
         * @returns {Adjustments} Current adjustment values
         */
        getAdjustments() {
            return {...this._adjustments};
        }

        /**
         * Set adjustment values
         * @param {Partial<Adjustments>} values - Adjustment values to update
         */
        setAdjustments(values) {
            this._captureBeforeState();
            this._adjustments = {
                ...this._adjustments,
                ...values,
            };
            this.emit('adjustments-changed', this._adjustments);
            this._captureSnapshot('Adjust colors');
        }

        /**
         * Reset adjustments to defaults
         */
        resetAdjustments() {
            this._adjustments = {...DEFAULT_ADJUSTMENTS};
            this.emit('adjustments-changed', this._adjustments);
        }

        // ==================== Color Roles ====================

        /**
         * Get color role assignments
         * @returns {ColorRoles} Color role mappings
         */
        getColorRoles() {
            return {...this._colorRoles};
        }

        /**
         * Set a specific color role
         * @param {string} role - Role name (e.g., 'background', 'color5')
         * @param {string} color - Hex color string
         */
        setColorRole(role, color) {
            if (!(role in this._colorRoles)) return;

            this._colorRoles[role] = color;
            this.emit('color-roles-changed', this._colorRoles);
        }

        /**
         * Set all color roles
         * @param {ColorRoles} roles - Color role mappings
         */
        setColorRoles(roles) {
            this._colorRoles = {...roles};
            this.emit('color-roles-changed', this._colorRoles);
        }

        /**
         * Semantic color names mapping to ANSI indices 0-15
         * @private
         * @type {string[]}
         */
        static SEMANTIC_NAMES = [
            'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
            'bright_black', 'bright_red', 'bright_green', 'bright_yellow',
            'bright_blue', 'bright_magenta', 'bright_cyan', 'bright_white',
        ];

        /**
         * Build color roles object from a palette array
         * @private
         * @param {string[]} palette - 16-color palette array
         * @param {Object} [extendedOverrides={}] - Extended color overrides
         * @returns {ColorRoles} Color role mappings
         */
        _buildColorRoles(palette, extendedOverrides = {}) {
            const roles = {
                background: palette[0],
                foreground: palette[15],
            };

            ThemeState.SEMANTIC_NAMES.forEach((name, i) => {
                roles[name] = palette[i];
                roles[`color${i}`] = palette[i];
            });

            // Extended colors: use overrides or auto-derive from palette
            roles.accent = extendedOverrides.accent || palette[4];
            roles.cursor = extendedOverrides.cursor || palette[15];
            roles.selection_foreground = extendedOverrides.selection_foreground || palette[0];
            roles.selection_background = extendedOverrides.selection_background || palette[15];

            return roles;
        }

        /**
         * Update color roles from current palette
         * Preserves any extended color overrides that were set manually
         * @private
         */
        _updateColorRolesFromPalette() {
            this._colorRoles = this._buildColorRoles(
                this._palette,
                this._extendedColors
            );
            this.emit('color-roles-changed', this._colorRoles);
        }

        /**
         * Create default color roles from default palette
         * @private
         * @returns {ColorRoles} Default color role mappings
         */
        _createDefaultColorRoles() {
            return this._buildColorRoles(DEFAULT_PALETTE);
        }

        // ==================== Extended Colors ====================

        /**
         * Valid extended color names
         * @private
         * @type {string[]}
         */
        static EXTENDED_COLOR_NAMES = [
            'accent',
            'cursor',
            'selection_foreground',
            'selection_background',
        ];

        /**
         * Set an extended color (accent, cursor, selection_*)
         * @param {string} name - Color name (accent, cursor, selection_foreground, selection_background)
         * @param {string} color - Hex color string
         */
        setExtendedColor(name, color) {
            if (!ThemeState.EXTENDED_COLOR_NAMES.includes(name)) return;

            this._captureBeforeState();
            this._extendedColors[name] = color;
            this._colorRoles[name] = color;
            this.emit('color-roles-changed', this._colorRoles);
            this._captureSnapshot(`Set ${name}`);
        }

        /**
         * Get extended color overrides
         * @returns {Object} Extended color overrides
         */
        getExtendedColors() {
            return {...this._extendedColors};
        }

        /**
         * Set all extended colors at once
         * @param {Object} colors - Extended color mappings
         */
        setExtendedColors(colors) {
            this._captureBeforeState();
            ThemeState.EXTENDED_COLOR_NAMES.forEach(name => {
                if (colors[name]) {
                    this._extendedColors[name] = colors[name];
                    this._colorRoles[name] = colors[name];
                }
            });
            this.emit('color-roles-changed', this._colorRoles);
            this._captureSnapshot('Set extended colors');
        }

        /**
         * Reset extended colors to auto-derived values
         */
        resetExtendedColors() {
            this._extendedColors = {};
            this._updateColorRolesFromPalette();
        }

        // ==================== App Overrides ====================

        /**
         * Get per-app color overrides
         * @returns {AppOverrides} App override mappings
         */
        getAppOverrides() {
            return {...this._appOverrides};
        }

        /**
         * Set override for a specific app
         * @param {string} appName - Application name
         * @param {ColorRoles} colors - Color overrides for app
         */
        setAppOverride(appName, colors) {
            this._appOverrides[appName] = {...colors};
            this.emit('app-overrides-changed', this._appOverrides);
        }

        /**
         * Remove override for a specific app
         * @param {string} appName - Application name
         */
        removeAppOverride(appName) {
            delete this._appOverrides[appName];
            this.emit('app-overrides-changed', this._appOverrides);
        }

        /**
         * Reset all app overrides
         */
        resetAppOverrides() {
            this._appOverrides = {};
            this.emit('app-overrides-changed', this._appOverrides);
        }

        /**
         * Set all app overrides at once
         * @param {AppOverrides} overrides - Complete app overrides object
         */
        setAppOverrides(overrides) {
            this._appOverrides = {...overrides};
            this.emit('app-overrides-changed', this._appOverrides);
        }

        // ==================== Neovim Theme ====================

        /**
         * Get selected Neovim theme
         * @returns {string|null} Theme name or null
         */
        getNeovimTheme() {
            return this._neovimTheme;
        }

        /**
         * Set Neovim theme
         * @param {string|null} theme - Theme name
         */
        setNeovimTheme(theme) {
            if (this._neovimTheme === theme) return;

            this._neovimTheme = theme;
            this.emit('neovim-theme-changed', theme || '');
        }

        // ==================== Additional Images ====================

        /**
         * Get additional images for theme
         * @returns {string[]} Array of image paths
         */
        getAdditionalImages() {
            return [...this._additionalImages];
        }

        /**
         * Set additional images
         * @param {string[]} images - Array of image paths
         */
        setAdditionalImages(images) {
            this._additionalImages = [...images];
        }

        /**
         * Add an additional image
         * @param {string} path - Image path
         */
        addAdditionalImage(path) {
            if (!this._additionalImages.includes(path)) {
                this._additionalImages.push(path);
            }
        }

        /**
         * Remove an additional image
         * @param {string} path - Image path
         */
        removeAdditionalImage(path) {
            const index = this._additionalImages.indexOf(path);
            if (index !== -1) {
                this._additionalImages.splice(index, 1);
            }
        }

        // ==================== Serialization ====================

        /**
         * Get full state as blueprint-compatible object
         * @returns {Object} Serializable state object
         */
        toBlueprint() {
            return {
                palette: {
                    colors: [...this._palette],
                    wallpaper: this._wallpaper,
                    wallpaperUrl: this._wallpaperMetadata?.url || null,
                    wallpaperSource: this._wallpaperMetadata?.source || 'local',
                    lightMode: this._lightMode,
                    lockedColors: [...this._lockedColors],
                    extendedColors: {...this._extendedColors},
                },
                adjustments: {...this._adjustments},
                appOverrides: {...this._appOverrides},
                settings: {
                    selectedNeovimConfig: this._neovimTheme,
                },
                timestamp: Date.now(),
            };
        }

        /**
         * Load state from blueprint
         * @param {Object} blueprint - Blueprint data
         */
        fromBlueprint(blueprint) {
            if (blueprint.palette) {
                this._loadPaletteFromBlueprint(blueprint.palette);
            }

            this._adjustments = blueprint.adjustments
                ? {...blueprint.adjustments}
                : {...DEFAULT_ADJUSTMENTS};

            // App overrides can be at top level or inside palette (aethr.no format)
            const appOverrides = blueprint.appOverrides || blueprint.palette?.appOverrides;
            this._appOverrides = appOverrides ? {...appOverrides} : {};

            if (blueprint.settings?.selectedNeovimConfig) {
                this._neovimTheme = blueprint.settings.selectedNeovimConfig;
            }

            this._emitAllSignals();
        }

        /**
         * Loads palette data from a blueprint palette object
         * @private
         * @param {Object} palette - Blueprint palette object
         */
        _loadPaletteFromBlueprint(palette) {
            this._extendedColors = palette.extendedColors ? {...palette.extendedColors} : {};

            if (palette.colors && Array.isArray(palette.colors)) {
                this._palette = this._normalizePalette(palette.colors);
                this._updateColorRolesFromPalette();
            }

            this._loadWallpaperFromBlueprint(palette);

            if (palette.lightMode !== undefined) {
                this._lightMode = palette.lightMode;
            }
        }

        /**
         * Normalizes a palette to exactly 16 colors
         * @private
         * @param {string[]} colors - Input colors
         * @returns {string[]} Normalized 16-color palette
         */
        _normalizePalette(colors) {
            const normalized = [...colors];
            while (normalized.length < 16) {
                normalized.push(DEFAULT_PALETTE[normalized.length]);
            }
            return normalized.slice(0, 16);
        }

        /**
         * Loads wallpaper data from a blueprint palette
         * @private
         * @param {Object} palette - Blueprint palette object
         */
        _loadWallpaperFromBlueprint(palette) {
            if (palette.wallpaper) {
                this._wallpaper = palette.wallpaper;
                this._wallpaperMetadata = {
                    url: palette.wallpaperUrl,
                    source: palette.wallpaperSource,
                };
            } else if (palette.wallpaperUrl) {
                this._wallpaper = null;
                this._wallpaperMetadata = {
                    url: palette.wallpaperUrl,
                    source: 'aethr.no',
                };
            }
        }

        /**
         * Emits all state-related signals for UI synchronization
         * @private
         */
        _emitAllSignals() {
            this.emit('blueprint-loaded');
            this.emit('palette-changed', this._palette);
            this.emit('wallpaper-changed', this._wallpaper || '');
            this.emit('light-mode-changed', this._lightMode);
            this.emit('color-roles-changed', this._colorRoles);
            this.emit('adjustments-changed', this._adjustments);
            this.emit('app-overrides-changed', this._appOverrides);
            this.emit('neovim-theme-changed', this._neovimTheme || '');
        }

        // ==================== Reset ====================

        /**
         * Reset all state to defaults
         */
        reset() {
            this._palette = [...DEFAULT_PALETTE];
            this._lockedColors = new Array(16).fill(false);
            this._wallpaper = null;
            this._wallpaperMetadata = null;
            this._lightMode = false;
            this._adjustments = {...DEFAULT_ADJUSTMENTS};
            this._extendedColors = {};
            this._colorRoles = this._createDefaultColorRoles();
            this._appOverrides = {};
            this._neovimTheme = null;
            this._additionalImages = [];

            this.emit('state-reset');
        }

        // ==================== History ====================

        /**
         * Create a snapshot object from given state
         * @private
         * @param {Object} state - State values
         * @param {string} action - Description
         * @returns {Object} Snapshot object
         */
        _createSnapshot(state, action) {
            return {
                palette: [...state.palette],
                extendedColors: {...state.extendedColors},
                adjustments: {...state.adjustments},
                lightMode: state.lightMode,
                action,
            };
        }

        /**
         * Capture state before a change (call before modifying state)
         * Only captures if this would be the first history entry
         * @private
         */
        _captureBeforeState() {
            if (this._isRestoring || this._historyManager.isRestoring) return;

            // Only capture "before" state if history is empty
            if (
                !this._historyManager.canUndo() &&
                !this._historyManager.canRedo()
            ) {
                this._historyManager.push(
                    this._createSnapshot(
                        {
                            palette: this._palette,
                            extendedColors: this._extendedColors,
                            adjustments: this._adjustments,
                            lightMode: this._lightMode,
                        },
                        'Initial state'
                    )
                );
            }
        }

        /**
         * Capture current state as a history snapshot (call after modifying state)
         * @private
         * @param {string} action - Description of what changed
         */
        _captureSnapshot(action) {
            if (this._isRestoring || this._historyManager.isRestoring) return;

            this._historyManager.push(
                this._createSnapshot(
                    {
                        palette: this._palette,
                        extendedColors: this._extendedColors,
                        adjustments: this._adjustments,
                        lightMode: this._lightMode,
                    },
                    action
                )
            );
        }

        /**
         * Restore state from a snapshot
         * @private
         * @param {Object} snapshot - History snapshot
         */
        _restoreSnapshot(snapshot) {
            this._isRestoring = true;

            this._palette = [...snapshot.palette];
            this._extendedColors = {...snapshot.extendedColors};
            this._adjustments = {...snapshot.adjustments};
            this._lightMode = snapshot.lightMode;

            this._updateColorRolesFromPalette();

            // Emit signals for UI updates
            this.emit('palette-changed', this._palette);
            this.emit('adjustments-changed', this._adjustments);
            this.emit('light-mode-changed', this._lightMode);

            this._isRestoring = false;
        }

        /**
         * Perform history navigation (undo or redo)
         * @private
         * @param {Function} navigateFn - History manager method to call
         * @returns {boolean} Whether navigation was performed
         */
        _performHistoryNavigation(navigateFn) {
            const snapshot = navigateFn.call(this._historyManager);
            if (!snapshot) return false;

            this._restoreSnapshot(snapshot);
            return true;
        }

        /** Undo last change */
        undo() {
            return this._performHistoryNavigation(this._historyManager.undo);
        }

        /** Redo previously undone change */
        redo() {
            return this._performHistoryNavigation(this._historyManager.redo);
        }

        /** Check if undo is available */
        canUndo() {
            return this._historyManager.canUndo();
        }

        /** Check if redo is available */
        canRedo() {
            return this._historyManager.canRedo();
        }

        /** Clear history (e.g., when loading a new wallpaper) */
        clearHistory() {
            this._historyManager.clear();
        }
    }
);

/**
 * Singleton instance of ThemeState
 * Use this for shared state across the application
 * @type {ThemeState}
 */
export const themeState = new ThemeState();
