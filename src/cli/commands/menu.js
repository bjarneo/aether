import GLib from 'gi://GLib';
import {ApplyBlueprintCommand} from './apply-blueprint.js';
import {BlueprintFinder} from '../utils/blueprint-finder.js';

/**
 * Command handler for interactive menu
 */
export class MenuCommand {
    /**
     * Executes the menu command
     */
    static execute() {
        const blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        const finder = new BlueprintFinder(blueprintsDir);
        const blueprints = finder.loadAll();
        if (blueprints.length === 0) {
            print('No blueprints found');
            return;
        }

        // Create menu options
        const blueprintNames = blueprints.map(
            bp => bp.name || bp.filename.replace('.json', '')
        );

        try {
            const program = GLib.find_program_in_path('omarchy-launch-walker');
            if (!program) {
                print('Error: walker not found');
                return;
            }
            const selected = this._runMenuCommand(
                program,
                ['--dmenu', '--width', '295', '--minheight', '1', '--maxheight', '600', '-p', 'Select blueprint…'],
                blueprintNames
            );
            if (selected && selected.trim()) {
                ApplyBlueprintCommand.execute(selected.trim());
            }
        } catch (e) {
            print(`Error: Menu command failed: ${e.message}`);
        }
    }

    

    static _runMenuCommand(commandPath, args, blueprintNames) {
        try {
            // Create input string
            const input = blueprintNames.join('\n');

            // Escape input properly for shell
            const escapedInput = input
                .replace(/"/g, '\\"')
                .replace(/\$/g, '\\$')
                .replace(/`/g, '\\`');

            const argString = args.map(arg => `"${arg}"`).join(' ');
            const fullCommand = `echo -e "${escapedInput}" | "${commandPath}" ${argString}`;

            // Execute using spawn_sync with shell
            const [, stdout, stderr, exitCode] = GLib.spawn_sync(
                null, // working directory
                ['sh', '-c', fullCommand], // Use shell to execute
                null, // inherit environment
                GLib.SpawnFlags.SEARCH_PATH, // flags
                null // child setup function
            );

            if (exitCode !== 0) {
                const errorMsg = new TextDecoder().decode(stderr).trim() || `Exit code ${exitCode}`;
                throw new Error(`Command failed: ${errorMsg}`);
            }
            return new TextDecoder().decode(stdout).trim();
        } catch (e) {
            throw new Error(`Command failed: ${e.message}`);
        }
    }
    // no-op: kept for potential future external CLI invocation
}
