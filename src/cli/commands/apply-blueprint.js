import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {BlueprintService} from '../../services/BlueprintService.js';
import {ColorMapper} from '../utils/color-mapper.js';

/**
 * Command handler for applying a blueprint theme
 * Applies saved blueprint to the system without launching GUI
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

            print(`✓ Applied blueprint: ${foundBlueprint.name || name}`);
            return true;
        } catch (e) {
            print(`Error: Failed to apply blueprint: ${e.message}`);
            return false;
        }
    }
}
