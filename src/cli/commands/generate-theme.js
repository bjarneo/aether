import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {ColorMapper} from '../utils/color-mapper.js';
import {extractColorsFromWallpaperIM} from '../../utils/color-extraction.js';

/**
 * Command handler for generating theme from wallpaper
 * Extracts colors and applies theme without launching GUI
 */
export class GenerateThemeCommand {
    /**
     * Executes the generate-theme command
     *
     * @param {string} wallpaperPath - Path to wallpaper image
     * @param {string} [extractionMode='normal'] - Extraction mode: 'normal', 'monochromatic', 'analogous', 'pastel', 'material', 'colorful', 'muted', 'bright'
     * @param {boolean} [lightMode=false] - Generate light mode theme
     * @param {Object} [options={}] - Additional options
     * @param {boolean} [options.noApply=false] - Generate only, don't apply theme
     * @param {string} [options.outputPath=null] - Custom output directory
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    static async execute(
        wallpaperPath,
        extractionMode = 'normal',
        lightMode = false,
        options = {}
    ) {
        const {noApply = false, outputPath = null} = options;

        if (!wallpaperPath) {
            print('Error: Wallpaper path is required');
            print(
                'Usage: aether --generate <wallpaper_path> [--extract-mode <mode>] [--light-mode] [--no-apply] [--output <path>]'
            );
            return false;
        }

        // Validate extraction mode
        const validModes = [
            'normal',
            'monochromatic',
            'analogous',
            'pastel',
            'material',
            'colorful',
            'muted',
            'bright',
        ];
        if (!validModes.includes(extractionMode)) {
            print(`Error: Invalid extraction mode: ${extractionMode}`);
            print(`Valid modes: ${validModes.join(', ')}`);
            return false;
        }

        // Validate output path if provided
        if (outputPath) {
            // Expand ~ to home directory
            let expandedPath = outputPath;
            if (expandedPath.startsWith('~/')) {
                expandedPath = GLib.build_filenamev([
                    GLib.get_home_dir(),
                    expandedPath.slice(2),
                ]);
            }
            options.outputPath = expandedPath;
        }

        try {
            // Validate wallpaper file exists
            const file = Gio.File.new_for_path(wallpaperPath);
            if (!file.query_exists(null)) {
                print(`Error: Wallpaper file not found: ${wallpaperPath}`);
                return false;
            }

            // Build extraction message
            let extractionMessage = `Extracting colors from: ${wallpaperPath}`;
            const modeDetails = [];
            if (extractionMode !== 'normal') {
                modeDetails.push(extractionMode);
            }
            if (lightMode) {
                modeDetails.push('light mode');
            }
            if (noApply) {
                modeDetails.push('generate only');
            }
            if (modeDetails.length > 0) {
                extractionMessage += ` (${modeDetails.join(', ')})`;
            }
            print(extractionMessage);

            // Extract colors from wallpaper
            const colors = await new Promise((resolve, reject) => {
                extractColorsFromWallpaperIM(
                    wallpaperPath,
                    lightMode,
                    colors => resolve(colors),
                    error => reject(error),
                    extractionMode
                );
            });

            if (!colors || colors.length !== 16) {
                print(
                    `Error: Failed to extract 16 colors (got ${colors?.length || 0})`
                );
                return false;
            }

            print('✓ Extracted 16 colors successfully');

            // Map colors to roles
            const colorRoles = ColorMapper.mapColorsToRoles(colors);

            // Apply theme with default settings
            const configWriter = new ConfigWriter();
            const settings = {}; // Use default settings
            const appOverrides = {}; // No app-specific overrides
            const additionalImages = []; // No additional images

            if (noApply) {
                // Generate only mode - no symlinks, no theme activation
                print('Generating theme files...');

                const result = configWriter.generateOnly({
                    colorRoles,
                    wallpaperPath,
                    settings,
                    lightMode,
                    appOverrides,
                    additionalImages,
                    outputPath: options.outputPath,
                });

                if (result.success) {
                    print(`✓ Theme files generated successfully`);
                    print(`  Output directory: ${result.themePath}`);
                    print('');
                    print('Generated files can be found in the output directory.');
                    print('No symlinks were created and no theme was activated.');
                } else {
                    print('✗ Failed to generate theme files');
                    return false;
                }
            } else {
                // Normal mode - full theme application
                print('Applying theme...');

                configWriter.applyTheme({
                    colorRoles,
                    wallpaperPath,
                    settings,
                    lightMode,
                    appOverrides,
                    additionalImages,
                    sync: true,
                });

                print('✓ Theme applied successfully');
            }

            return true;
        } catch (e) {
            print(`Error: Failed to generate theme: ${e.message}`);
            if (e.stack) {
                printerr(e.stack);
            }
            return false;
        }
    }
}
