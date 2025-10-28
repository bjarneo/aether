import {ConfigWriter} from '../../utils/ConfigWriter.js';
import {ColorMapper} from '../utils/color-mapper.js';
import {Output} from '../utils/output.js';

/**
 * Command handler for applying a blueprint
 */
export class ApplyBlueprintCommand {
    /**
     * @param {BlueprintFinder} blueprintFinder - Blueprint finder instance
     */
    constructor(blueprintFinder) {
        this.blueprintFinder = blueprintFinder;
    }

    /**
     * Executes the apply-blueprint command
     *
     * @param {string} name - Name of the blueprint to apply
     * @returns {boolean} True if successful, false otherwise
     */
    execute(name) {
        if (!name) {
            Output.error('Blueprint name is required');
            Output.print('Usage: ./aether apply-blue-print <name>');
            return false;
        }

        // Find the blueprint
        const blueprint = this.blueprintFinder.findByName(name);

        if (!blueprint) {
            Output.error(`Blueprint "${name}" not found`);
            return false;
        }

        try {
            // Extract data from blueprint
            const palette = blueprint.palette;
            if (!palette || !palette.colors) {
                Output.error('Blueprint has no color palette');
                return false;
            }

            // Map colors to roles
            const colorRoles = ColorMapper.mapColorsToRoles(palette.colors);

            // Get settings, defaulting to sensible values
            const settings = blueprint.settings || {};
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

            Output.success(`Applied blueprint: ${blueprint.name || name}`);

            // Exit immediately - async operations continue in background
            return true;
        } catch (e) {
            Output.error(`Failed to apply blueprint: ${e.message}`);
            return false;
        }
    }
}

