import GLib from 'gi://GLib';
import {enumerateDirectory, loadJsonFile} from '../../utils/file-utils.js';
import {ApplyBlueprintCommand} from './apply-blueprint.js';

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

        // Get the list of blueprints
        const blueprints = [];
        enumerateDirectory(blueprintsDir, (fileInfo, filePath, fileName) => {
            if (!fileName.endsWith('.json')) return;

            const blueprint = loadJsonFile(filePath);
            if (blueprint) {
                blueprint.filename = fileName;
                blueprint.path = filePath;
                blueprints.push(blueprint);
            }
        });

        if (blueprints.length === 0) {
            print('No blueprints found');
            return;
        }

        // Create menu options
        const blueprintNames = blueprints.map(
            bp => bp.name || bp.filename.replace('.json', '')
        );

        // Try different menu launchers using proper GJS methods
        let selected = null;

        try {
            // Try Walker first
            if (this._commandExists('omarchy-launch-walker')) {
                selected = this._runMenuCommand(
                    'omarchy-launch-walker',
                    [
                        '--dmenu',
                        '--width',
                        '295',
                        '--minheight',
                        '1',
                        '--maxheight',
                        '600',
                        '-p',
                        'Select blueprint…',
                    ],
                    blueprintNames
                );
            } else {
                print(
                    'Error: No menu launcher found (walker/dmenu/rofi/fzf). Please install one of these tools.'
                );
                return;
            }

            // If user selected something, apply it using internal command
            if (selected && selected.trim()) {
                ApplyBlueprintCommand.execute(selected.trim());
            }
        } catch (e) {
            print(`Error: Menu command failed: ${e.message}`);
        }
    }

    static _commandExists(command) {
        try {
            // Get the system PATH which includes custom PATH extensions
            const env = GLib.listenv();
            const path = env['PATH'] || '/usr/bin:/usr/local/bin';

            // Try to find the command in PATH
            const findCommand = GLib.find_program_in_path(command);
            return findCommand !== null;
        } catch (e) {
            return false;
        }
    }

    static _runMenuCommand(command, args, blueprintNames) {
        try {
            // Create input string
            const input = blueprintNames.join('\n');

            // Escape input properly for shell
            const escapedInput = input
                .replace(/"/g, '\\"')
                .replace(/\$/g, '\\$')
                .replace(/`/g, '\\`');

            // Use full path to avoid PATH issues
            const omarchyBin = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local',
                'share',
                'omarchy',
                'bin',
            ]);
            const fullCommandPath = GLib.build_filenamev([omarchyBin, command]);

            // Build the full command with piping - exactly like the bash script
            const argString = args.map(arg => `"${arg}"`).join(' ');
            const fullCommand = `echo -e "${escapedInput}" | "${fullCommandPath}" ${argString}`;

            // Execute using spawn_sync with shell
            const [, stdout, stderr, exitCode] = GLib.spawn_sync(
                null, // working directory
                ['sh', '-c', fullCommand], // Use shell to execute
                null, // inherit environment
                GLib.SpawnFlags.SEARCH_PATH, // flags
                null // child setup function
            );

            if (exitCode !== 0) {
                try {
                    const errorMsg =
                        new TextDecoder().decode(stderr).trim() ||
                        `Exit code ${exitCode}`;
                    throw new Error(`Command failed: ${errorMsg}`);
                } catch (decodeError) {
                    throw new Error(
                        `Command failed with exit code ${exitCode}`
                    );
                }
            }

            try {
                const output = new TextDecoder().decode(stdout).trim();
                return output;
            } catch (decodeError) {
                // Fallback to toString if TextDecoder fails
                const output = stdout.toString().trim();
                return output;
            }
        } catch (e) {
            throw new Error(`Command failed: ${e.message}`);
        }
    }
    // no-op: kept for potential future external CLI invocation
}
