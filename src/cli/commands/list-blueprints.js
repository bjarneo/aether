import GLib from 'gi://GLib';
import {BlueprintFinder} from '../utils/blueprint-finder.js';

export class ListBlueprintsCommand {
    static execute() {
        const blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);
        const finder = new BlueprintFinder(blueprintsDir);
        const blueprints = finder.loadAll();

        // Sort by timestamp (newest first)
        blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (blueprints.length === 0) return print('No blueprints found.');

        blueprints.forEach(blueprint => {
            const name =
                blueprint.name || blueprint.filename.replace('.json', '');
            print(name);
        });
    }
}
