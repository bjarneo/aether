import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
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
            // Provide input via stdin directly (avoid shell and escaping issues)
            const input = blueprintNames.join('\n');

            const subprocess = new Gio.Subprocess({
                argv: [commandPath, ...args],
                flags: Gio.SubprocessFlags.STDIN_PIPE |
                       Gio.SubprocessFlags.STDOUT_PIPE |
                       Gio.SubprocessFlags.STDERR_PIPE,
            });

            subprocess.init(null);

            const [, stdout, stderr] = subprocess.communicate_utf8(input, null);
            const exitCode = subprocess.get_exit_status();

            if (exitCode !== 0) {
                const errorMsg = (stderr || '').trim() || `Exit code ${exitCode}`;
                throw new Error(`Command failed: ${errorMsg}`);
            }

            return (stdout || '').trim();
        } catch (e) {
            throw new Error(`Command failed: ${e.message}`);
        }
    }
    // no-op: kept for potential future external CLI invocation
}
