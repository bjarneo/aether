import GLib from 'gi://GLib';
import {
    enumerateDirectory,
    ensureDirectoryExists,
    loadJsonFile,
    saveJsonFile,
} from '../utils/file-utils.js';

/**
 * Service for managing blueprint themes (saving, loading, listing, finding)
 * Centralizes all blueprint operations to ensure consistency between GUI and CLI
 */
export class BlueprintService {
    /**
     * Creates a new BlueprintService instance
     * @param {Object} [blueprintManager] - Optional BlueprintManager for GUI operations
     */
    constructor(blueprintManager) {
        this.blueprintManager = blueprintManager;
        this.blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        // Ensure blueprints directory exists
        ensureDirectoryExists(this.blueprintsDir);
    }

    /**
     * Saves a blueprint to disk (GUI mode - prompts for name)
     * @param {Object} palette - Palette object with colors and wallpaper
     * @param {Object} settings - Theme settings
     * @param {boolean} lightMode - Whether using light mode
     */
    saveBlueprint(palette, settings, lightMode) {
        palette.lightMode = lightMode;

        const blueprint = {
            palette: palette,
            timestamp: Date.now(),
            settings: settings,
        };

        this.blueprintManager.saveBlueprint(blueprint);
    }

    /**
     * Loads all blueprints from the blueprints directory
     * @returns {Array<Object>} Array of blueprint objects with metadata
     */
    loadAll() {
        const blueprints = [];

        try {
            enumerateDirectory(
                this.blueprintsDir,
                (fileInfo, filePath, fileName) => {
                    if (!fileName.endsWith('.json')) {
                        return;
                    }

                    const blueprint = this._loadBlueprintFromFile(
                        filePath,
                        fileName
                    );
                    if (blueprint) {
                        blueprints.push(blueprint);
                    }
                }
            );
        } catch (error) {
            console.error(`Error loading blueprints: ${error.message}`);
        }

        return blueprints;
    }

    /**
     * Finds a blueprint by name (case-insensitive)
     * @param {string} name - Name to search for
     * @returns {Object|null} Blueprint object or null if not found
     */
    findByName(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        const blueprints = this.loadAll();
        const lowerName = name.toLowerCase();

        // First try exact name match
        let found = blueprints.find(
            bp => bp.name && bp.name.toLowerCase() === lowerName
        );

        // If not found, try partial filename match
        if (!found) {
            found = blueprints.find(bp =>
                bp.filename
                    .toLowerCase()
                    .replace('.json', '')
                    .includes(lowerName)
            );
        }

        return found || null;
    }

    /**
     * Loads a blueprint from a file
     * @param {string} filePath - Absolute path to blueprint file
     * @param {string} fileName - Filename of the blueprint
     * @returns {Object|null} Blueprint object with metadata or null if invalid
     * @private
     */
    _loadBlueprintFromFile(filePath, fileName) {
        try {
            const data = loadJsonFile(filePath);
            if (!data) {
                return null;
            }

            // Add metadata
            data.path = filePath;
            data.filename = fileName;
            data.name =
                data.name ||
                GLib.path_get_basename(filePath).replace('.json', '');

            return data;
        } catch (error) {
            console.error(
                `Error loading blueprint from ${filePath}: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Validates a blueprint structure
     * @param {Object} blueprint - Blueprint to validate
     * @returns {boolean} True if valid, false otherwise
     */
    validateBlueprint(blueprint) {
        if (!blueprint || typeof blueprint !== 'object') {
            return false;
        }

        if (!blueprint.palette || typeof blueprint.palette !== 'object') {
            return false;
        }

        if (
            !Array.isArray(blueprint.palette.colors) ||
            blueprint.palette.colors.length < 16
        ) {
            return false;
        }

        return true;
    }

    /**
     * Loads a blueprint into the GUI (requires UI components)
     * @param {Object} blueprint - Blueprint to load
     * @param {Object} paletteGenerator - PaletteGenerator component
     * @param {Object} colorSynthesizer - ColorSynthesizer component
     * @param {Object} settingsSidebar - SettingsSidebar component
     */
    loadBlueprint(
        blueprint,
        paletteGenerator,
        colorSynthesizer,
        settingsSidebar
    ) {
        try {
            console.log('Loading blueprint:', blueprint.name);

            // Reset adjustment sliders when loading a blueprint
            settingsSidebar.resetAdjustments();

            // Reset per-application overrides when loading a blueprint
            paletteGenerator.resetAppOverrides();

            // Switch to custom tab for blueprint editing
            paletteGenerator.switchToCustomTab();

            // Load palette (colors, wallpaper, locks)
            if (blueprint.palette) {
                paletteGenerator.loadBlueprintPalette(blueprint.palette);

                // Sync light mode to sidebar
                if (blueprint.palette.lightMode !== undefined) {
                    settingsSidebar.setLightMode(blueprint.palette.lightMode);
                }

                // Auto-assign color roles from palette
                if (blueprint.palette.colors) {
                    colorSynthesizer.setPalette(blueprint.palette.colors);
                }
            }

            // Load settings (including Neovim theme selection)
            if (blueprint.settings) {
                if (blueprint.settings.selectedNeovimConfig !== undefined) {
                    settingsSidebar.setNeovimTheme(
                        blueprint.settings.selectedNeovimConfig
                    );
                }
            }
        } catch (e) {
            console.error(`Error loading blueprint: ${e.message}`);
        }
    }
}
