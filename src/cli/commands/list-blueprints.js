import Gio from 'gi://Gio';
import {Output} from '../utils/output.js';

/**
 * Command handler for listing blueprints
 */
export class ListBlueprintsCommand {
    /**
     * @param {string} blueprintsDir - Directory path containing blueprints
     * @param {BlueprintFinder} blueprintFinder - Blueprint finder instance
     */
    constructor(blueprintsDir, blueprintFinder) {
        this.blueprintsDir = blueprintsDir;
        this.blueprintFinder = blueprintFinder;
    }

    /**
     * Executes the list-blueprints command
     */
    execute() {
        // Check if blueprints directory exists
        const dir = Gio.File.new_for_path(this.blueprintsDir);
        if (!dir.query_exists(null)) {
            Output.print('No blueprints directory found.');
            Output.print(`Directory: ${this.blueprintsDir}`);
            return;
        }

        const blueprints = this.blueprintFinder.loadAll();

        // Sort by timestamp (newest first)
        blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (blueprints.length === 0) {
            Output.print('No blueprints found.');
            Output.print(`Directory: ${this.blueprintsDir}`);
            return;
        }

        // Print blueprints
        blueprints.forEach((blueprint) => {
            const name = blueprint.name || blueprint.filename.replace('.json', '');
            Output.print(name);
        });
    }
}

