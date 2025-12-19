import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {BlueprintService} from '../../services/BlueprintService.js';
import {ColorMapper} from '../utils/color-mapper.js';
import {ensureDirectoryExists} from '../../utils/file-utils.js';

/**
 * Command handler for applying a blueprint theme
 * Applies saved blueprint to the system without launching GUI
 */
export class ApplyBlueprintCommand {
    /**
     * Executes the apply-blueprint command
     *
     * @param {string} name - Name of the blueprint to apply
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    static async execute(name) {
        if (!name) {
            print('Error: Blueprint name is required');
            print('Usage: aether --apply-blueprint <name>');
            return false;
        }

        try {
            const blueprintService = new BlueprintService();
            const foundBlueprint = blueprintService.findByName(name);

            if (!foundBlueprint) {
                print(`Error: Blueprint "${name}" not found`);
                print('\nAvailable blueprints:');
                const allBlueprints = blueprintService.loadAll();
                if (allBlueprints.length === 0) {
                    print('  (none)');
                } else {
                    allBlueprints.forEach(bp => {
                        const displayName =
                            bp.name || bp.filename.replace('.json', '');
                        print(`  - ${displayName}`);
                    });
                }
                return false;
            }

            // Validate blueprint structure
            if (!blueprintService.validateBlueprint(foundBlueprint)) {
                print('Error: Blueprint has invalid structure');
                return false;
            }

            const palette = foundBlueprint.palette;

            // Download wallpaper if wallpaperUrl is present and wallpaper is missing
            let wallpaperPath = palette.wallpaper;
            if (palette.wallpaperUrl && !wallpaperPath) {
                wallpaperPath = await this._downloadWallpaper(
                    palette.wallpaperUrl
                );
                if (!wallpaperPath) {
                    print(
                        'Warning: Failed to download wallpaper, continuing without it'
                    );
                }
            }

            const colorRoles = ColorMapper.mapColorsToRoles(palette.colors);

            const settings = foundBlueprint.settings || {};
            const lightMode = palette.lightMode || settings.lightMode || false;
            const appOverrides = palette.appOverrides || {};

            const configWriter = new ConfigWriter();
            configWriter.applyTheme({
                colorRoles,
                wallpaperPath,
                settings,
                lightMode,
                appOverrides,
                additionalImages: [],
                sync: true,
            });

            print(`✓ Applied blueprint: ${foundBlueprint.name || name}`);
            return true;
        } catch (e) {
            print(`Error: Failed to apply blueprint: ${e.message}`);
            return false;
        }
    }

    /**
     * Downloads a wallpaper from a URL
     * @param {string} url - URL to download from
     * @returns {Promise<string|null>} Path to downloaded wallpaper or null on failure
     * @private
     */
    static async _downloadWallpaper(url) {
        try {
            print(`Downloading wallpaper from: ${url}`);

            const wallpapersDir = GLib.build_filenamev([
                GLib.get_user_data_dir(),
                'aether',
                'wallpapers',
            ]);
            ensureDirectoryExists(wallpapersDir);

            // Extract filename from URL
            const urlParts = url.split('/');
            const filename =
                urlParts[urlParts.length - 1] || 'imported-wallpaper.jpg';
            const wallpaperPath = GLib.build_filenamev([
                wallpapersDir,
                filename,
            ]);

            // Check if already downloaded
            const file = Gio.File.new_for_path(wallpaperPath);
            if (file.query_exists(null)) {
                print(`Wallpaper already downloaded: ${wallpaperPath}`);
                return wallpaperPath;
            }

            // Download wallpaper
            const {wallhavenService} = await import(
                '../../services/wallhaven-service.js'
            );
            await wallhavenService.downloadWallpaper(url, wallpaperPath);

            print(`✓ Wallpaper downloaded: ${wallpaperPath}`);
            return wallpaperPath;
        } catch (error) {
            print(`Error downloading wallpaper: ${error.message}`);
            return null;
        }
    }
}
