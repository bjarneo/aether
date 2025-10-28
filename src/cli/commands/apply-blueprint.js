import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {enumerateDirectory, loadJsonFile} from '../../utils/file-utils.js';

/**
 * Command handler for applying a blueprint
 */
export class ApplyBlueprintCommand {
    /**
     * Executes the apply-blueprint command
     *
     * @param {string} name - Name of the blueprint to apply
     * @returns {boolean} True if successful, false otherwise
     */
    static execute(name) {
        if (!name) {
            print('Error: Blueprint name is required');
            print('Usage: aether --apply-blueprint <name>');
            return false;
        }

        const blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        // Find blueprint
        let foundBlueprint = null;
        enumerateDirectory(blueprintsDir, (fileInfo, filePath, fileName) => {
            if (!fileName.endsWith('.json')) return;

            const blueprint = loadJsonFile(filePath);
            if (blueprint) {
                blueprint.filename = fileName;
                blueprint.path = filePath;

                // Try exact match first
                if (
                    blueprint.name &&
                    blueprint.name.toLowerCase() === name.toLowerCase()
                ) {
                    foundBlueprint = blueprint;
                    return;
                }

                // Try partial match on filename if no exact match
                if (
                    fileName
                        .toLowerCase()
                        .replace('.json', '')
                        .includes(name.toLowerCase())
                ) {
                    foundBlueprint = blueprint;
                    return;
                }
            }
        });

        if (!foundBlueprint) {
            print(`Error: Blueprint "${name}" not found`);
            return false;
        }

        try {
            // Extract data from blueprint
            const palette = foundBlueprint.palette;
            if (!palette || !palette.colors) {
                print('Error: Blueprint has no color palette');
                return false;
            }

            // Map colors to roles - use palette.colors array
            const colorRoles = {
                background: palette.colors[0],
                foreground: palette.colors[15],
                color0: palette.colors[0],
                color1: palette.colors[1],
                color2: palette.colors[2],
                color3: palette.colors[3],
                color4: palette.colors[4],
                color5: palette.colors[5],
                color6: palette.colors[6],
                color7: palette.colors[7],
                color8: palette.colors[8],
                color9: palette.colors[9],
                color10: palette.colors[10],
                color11: palette.colors[11],
                color12: palette.colors[12],
                color13: palette.colors[13],
                color14: palette.colors[14],
                color15: palette.colors[15],
            };

            // Get settings, defaulting to sensible values
            const settings = foundBlueprint.settings || {};
            const lightMode = palette.lightMode || settings.lightMode || false;
            const appOverrides = palette.appOverrides || {};

            const configWriter = new ConfigWriter();
            configWriter.applyTheme(
                colorRoles,
                palette.wallpaper,
                settings,
                lightMode,
                appOverrides,
                true
            );

            print(`Applied blueprint: ${foundBlueprint.name || name}`);
            return true;
        } catch (e) {
            print(`Error: Failed to apply blueprint: ${e.message}`);
            return false;
        }
    }
}
