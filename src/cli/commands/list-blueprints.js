import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {enumerateDirectory, loadJsonFile} from '../../utils/file-utils.js';

/**
 * Command handler for listing blueprints
 */
export class ListBlueprintsCommand {
    /**
     * Executes the list-blueprints command
     */
    static execute() {
        const blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        // Check if blueprints directory exists
        const dir = Gio.File.new_for_path(blueprintsDir);
        if (!dir.query_exists(null)) {
            print('No blueprints directory found.');
            print(`Directory: ${blueprintsDir}`);
            return;
        }

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

        // Sort by timestamp (newest first)
        blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (blueprints.length === 0) {
            print('No blueprints found.');
            print(`Directory: ${blueprintsDir}`);
            return;
        }

        // Print blueprints
        blueprints.forEach(blueprint => {
            const name =
                blueprint.name || blueprint.filename.replace('.json', '');
            print(name);
        });
    }
}
