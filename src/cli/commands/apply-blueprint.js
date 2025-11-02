import GLib from 'gi://GLib';
import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {BlueprintFinder} from '../utils/blueprint-finder.js';
import {ColorMapper} from '../utils/color-mapper.js';

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
        const finder = new BlueprintFinder(blueprintsDir);
        const foundBlueprint = finder.findByName(name);

        if (!foundBlueprint) {
            print(`Error: Blueprint "${name}" not found`);
            return false;
        }

        try {
            const palette = foundBlueprint.palette;
            if (!palette || !palette.colors) {
                print('Error: Blueprint has no color palette');
                return false;
            }

            const colorRoles = ColorMapper.mapColorsToRoles(palette.colors);

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
                [],
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
