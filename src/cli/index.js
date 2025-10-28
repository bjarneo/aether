import GLib from 'gi://GLib';
import {ApplyBlueprintCommand} from './commands/apply-blueprint.js';
import {ListBlueprintsCommand} from './commands/list-blueprints.js';
import {HelpCommand} from './commands/help.js';
import {InstallMenuCommand} from './commands/install-menu.js';
import {BlueprintFinder} from './utils/blueprint-finder.js';
import {Output} from './utils/output.js';

/**
 * Main CLI interface for Aether
 */
export class AetherCLI {
    constructor() {
        this.blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        // Initialize services
        this.blueprintFinder = new BlueprintFinder(this.blueprintsDir);

        // Initialize commands
        this.commands = {
            'blue-prints': new ListBlueprintsCommand(this.blueprintsDir, this.blueprintFinder),
            'apply-blue-print': new ApplyBlueprintCommand(this.blueprintFinder),
            'install-menu': new InstallMenuCommand(),
            'help': new HelpCommand(),
        };
    }

    /**
     * Process command line arguments and run appropriate command
     *
     * @param {string[]} args - Command line arguments
     */
    run(args) {
        // Handle help flags
        if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
            this.commands.help.execute();
            return;
        }

        const command = args[0];

        // Find the appropriate command handler
        const commandHandler = this.commands[command];

        if (!commandHandler) {
            Output.error(`Unknown command: ${command}`);
            Output.print('Run "./aether --help" for usage information.');
            return;
        }

        // Execute the command
        if (command === 'apply-blue-print') {
            const blueprintName = args[1];
            commandHandler.execute(blueprintName);
        } else {
            commandHandler.execute();
        }
    }
}

// Run the CLI when executed directly
const cli = new AetherCLI();
// ARGV contains all arguments passed to the script
const args = typeof ARGV !== 'undefined' ? ARGV : [];
cli.run(args);
