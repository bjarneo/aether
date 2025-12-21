import Gio from 'gi://Gio';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {ColorMapper} from '../utils/color-mapper.js';
import {readFileAsText} from '../../utils/file-utils.js';
import {parseBase16Yaml} from '../../utils/base16-utils.js';

/**
 * Command handler for importing Base16 color scheme
 * Parses Base16 YAML and applies theme without launching GUI
 */
export class ImportBase16Command {
    /**
     * Executes the import-base16 command
     *
     * @param {string} filePath - Path to Base16 YAML file
     * @param {Object} options - Additional options
     * @param {string} [options.wallpaperPath] - Optional wallpaper path to include
     * @param {boolean} [options.lightMode=false] - Whether this is a light mode theme
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    static async execute(filePath, options = {}) {
        const {wallpaperPath = null, lightMode = false} = options;

        if (!filePath) {
            print('Error: Base16 file path is required');
            print('Usage: aether --import-base16 <file.yaml> [--wallpaper <path>]');
            return false;
        }

        try {
            // Validate file exists
            const file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) {
                print(`Error: File not found: ${filePath}`);
                return false;
            }

            print(`Importing Base16 scheme from: ${filePath}`);

            // Read and parse the file
            const content = readFileAsText(filePath);
            const result = parseBase16Yaml(content);

            if (!result.colors || result.colors.length !== 16) {
                print(
                    `Error: Failed to parse 16 colors (got ${result.colors?.length || 0})`
                );
                return false;
            }

            print(`✓ Parsed scheme: ${result.scheme}`);
            print(`  Author: ${result.author}`);

            // Map colors to roles
            const colorRoles = ColorMapper.mapColorsToRoles(result.colors);

            // Apply theme
            const configWriter = new ConfigWriter();
            const settings = {}; // Use default settings
            const appOverrides = {}; // No app-specific overrides
            const additionalImages = []; // No additional images

            print('Applying theme...');

            // Use provided wallpaper or null
            const finalWallpaperPath = wallpaperPath || null;

            if (finalWallpaperPath) {
                const wpFile = Gio.File.new_for_path(finalWallpaperPath);
                if (!wpFile.query_exists(null)) {
                    print(`Warning: Wallpaper not found: ${finalWallpaperPath}`);
                }
            }

            configWriter.applyTheme({
                colorRoles,
                wallpaperPath: finalWallpaperPath,
                settings,
                lightMode,
                appOverrides,
                additionalImages,
                sync: true,
            });

            print('✓ Theme applied successfully');
            return true;
        } catch (e) {
            print(`Error: Failed to import Base16 scheme: ${e.message}`);
            if (e.stack) {
                printerr(e.stack);
            }
            return false;
        }
    }
}
