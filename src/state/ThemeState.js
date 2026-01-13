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
 * @property {number} contrast - Contrast adjustment (-100 to 100)
 * @property {number} brightness - Brightness adjustment (-100 to 100)
 * @property {number} hueShift - Hue shift adjustment (0 to 360)
 * @property {number} temperature - Temperature adjustment (-100 to 100)
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
    contrast: 0,
    brightness: 0,
    hueShift: 0,
    temperature: 0,
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
         */
        setPalette(colors, {silent = false} = {}) {
            if (!Array.isArray(colors) || colors.length !== 16) {
                console.error('Invalid palette: must be array of 16 colors');
                return;
            }

            this._palette = [...colors];
            this._updateColorRolesFromPalette();

            if (!silent) {
                this.emit('palette-changed', this._palette);
            }
        }

        /**
         * Set a single color in the palette
         * @param {number} index - Color index (0-15)
         * @param {string} color - Hex color string
         */
        setColor(index, color) {
            if (index < 0 || index > 15) return;

            this._palette[index] = color;
            this._updateColorRolesFromPalette();
            this.emit('palette-changed', this._palette);
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

            this._lightMode = enabled;
            this.emit('light-mode-changed', enabled);
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
            this._adjustments = {
                ...this._adjustments,
                ...values,
            };
            this.emit('adjustments-changed', this._adjustments);
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
         * Build color roles object from a palette array
         * @private
         * @param {string[]} palette - 16-color palette array
         * @returns {ColorRoles} Color role mappings
         */
        _buildColorRoles(palette) {
            const semanticNames = [
                'black', 'red', 'green', 'yellow',
                'blue', 'magenta', 'cyan', 'white',
                'bright_black', 'bright_red', 'bright_green', 'bright_yellow',
                'bright_blue', 'bright_magenta', 'bright_cyan', 'bright_white',
            ];

            const roles = {
                background: palette[0],
                foreground: palette[15],
            };

            // Map semantic names and color0-15 aliases
            semanticNames.forEach((name, i) => {
                roles[name] = palette[i];
                roles[`color${i}`] = palette[i];
            });

            return roles;
        }

        /**
         * Update color roles from current palette
         * @private
         */
        _updateColorRolesFromPalette() {
            this._colorRoles = this._buildColorRoles(this._palette);
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
                const {palette} = blueprint;

                if (palette.colors) {
                    this.setPalette(palette.colors, {silent: true});
                }

                if (palette.wallpaper) {
                    this._wallpaper = palette.wallpaper;
                    this._wallpaperMetadata = {
                        url: palette.wallpaperUrl,
                        source: palette.wallpaperSource,
                    };
                }

                if (palette.lightMode !== undefined) {
                    this._lightMode = palette.lightMode;
                }

                // Note: lockedColors not restored per CLAUDE.md
            }

            // Restore adjustments (or reset to defaults if not present)
            this._adjustments = blueprint.adjustments
                ? {...blueprint.adjustments}
                : {...DEFAULT_ADJUSTMENTS};

            // Restore app overrides (or reset if not present)
            this._appOverrides = blueprint.appOverrides
                ? {...blueprint.appOverrides}
                : {};

            if (blueprint.settings?.selectedNeovimConfig) {
                this._neovimTheme = blueprint.settings.selectedNeovimConfig;
            }

            // Emit all signals for components to sync
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
            this._colorRoles = this._createDefaultColorRoles();
            this._appOverrides = {};
            this._neovimTheme = null;
            this._additionalImages = [];

            this.emit('state-reset');
        }
    }
);

/**
 * Singleton instance of ThemeState
 * Use this for shared state across the application
 * @type {ThemeState}
 */
export const themeState = new ThemeState();
