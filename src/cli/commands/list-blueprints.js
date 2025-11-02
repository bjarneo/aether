import {BlueprintService} from '../../services/BlueprintService.js';

/**
 * Command handler for listing all saved blueprint themes
 * Lists blueprints sorted by timestamp (newest first)
 */
export class ListBlueprintsCommand {
    /**
     * Executes the list-blueprints command
     * Prints all blueprint names to stdout
     */
    static execute() {
        try {
            const blueprintService = new BlueprintService();
            const blueprints = blueprintService.loadAll();

            // Sort by timestamp (newest first)
            blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (blueprints.length === 0) {
                print('No blueprints found.');
                return;
            }

            blueprints.forEach(blueprint => {
                const name =
                    blueprint.name || blueprint.filename.replace('.json', '');
                print(name);
            });
        } catch (error) {
            print(`Error listing blueprints: ${error.message}`);
        }
    }
}
