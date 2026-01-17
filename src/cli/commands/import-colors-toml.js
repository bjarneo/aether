/**
 * CLI command for importing colors.toml color scheme
 * Parses flat TOML format and applies theme without launching GUI
 *
 * @module ImportColorsTomlCommand
 */

import Gio from 'gi://Gio';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {ColorMapper} from '../utils/color-mapper.js';
import {readFileAsText} from '../../utils/file-utils.js';
import {parseColorsToml} from '../../utils/toml-utils.js';

/**
 * Command handler for importing colors.toml color scheme
 */
export class ImportColorsTomlCommand {
    /**
     * Executes the import-colors-toml command
     *
     * @param {string} filePath - Path to colors.toml file
     * @param {Object} options - Additional options
     * @param {string} [options.wallpaperPath] - Optional wallpaper path
     * @param {boolean} [options.lightMode=false] - Light mode theme
     * @returns {Promise<boolean>} True if successful
     */
    static async execute(filePath, options = {}) {
        const {wallpaperPath = null, lightMode = false} = options;

        if (!filePath) {
            print('Error: colors.toml file path is required');
            print(
                'Usage: aether --import-colors-toml <file.toml> [--wallpaper <path>]'
            );
            return false;
        }

        try {
            // Validate file exists
            const file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) {
                print(`Error: File not found: ${filePath}`);
                return false;
            }

            print(`Importing colors.toml from: ${filePath}`);

            // Read and parse the file
            const content = readFileAsText(filePath);
            const result = parseColorsToml(content);

            if (!result.colors || result.colors.length !== 16) {
                print(
                    `Error: Failed to parse 16 colors (got ${result.colors?.length || 0})`
                );
                return false;
            }

            print(`✓ Parsed ${result.colors.length} colors`);
            if (Object.keys(result.extendedColors).length > 0) {
                print(
                    `✓ Found extended colors: ${Object.keys(result.extendedColors).join(', ')}`
                );
            }

            // Map colors to roles with extended colors
            const colorRoles = ColorMapper.mapColorsToRoles(
                result.colors,
                result.extendedColors
            );

            // Apply theme
            const configWriter = new ConfigWriter();
            const settings = {};
            const appOverrides = {};
            const additionalImages = [];

            print('Applying theme...');

            const finalWallpaperPath = wallpaperPath || null;
            if (finalWallpaperPath) {
                const wpFile = Gio.File.new_for_path(finalWallpaperPath);
                if (!wpFile.query_exists(null)) {
                    print(
                        `Warning: Wallpaper not found: ${finalWallpaperPath}`
                    );
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
            print(`Error: Failed to import colors.toml: ${e.message}`);
            if (e.stack) {
                printerr(e.stack);
            }
            return false;
        }
    }
}
