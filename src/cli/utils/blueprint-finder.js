import GLib from 'gi://GLib';
import {enumerateDirectory, loadJsonFile} from '../../utils/file-utils.js';

/**
 * Utility for finding and loading blueprints
 */
export class BlueprintFinder {
    /**
     * @param {string} blueprintsDir - Directory path containing blueprint files
     */
    constructor(blueprintsDir) {
        this.blueprintsDir = blueprintsDir;
    }

    /**
     * Finds a blueprint by name (exact or partial match)
     *
     * @param {string} name - Blueprint name to search for
     * @returns {Object|null} Blueprint object or null if not found
     */
    findByName(name) {
        const blueprints = this._loadAllBlueprints();

        // Try exact match first
        let found = blueprints.find(
            bp => bp.name && bp.name.toLowerCase() === name.toLowerCase()
        );

        // Try partial match on filename if no exact match
        if (!found) {
            found = blueprints.find(bp =>
                bp.filename
                    .toLowerCase()
                    .replace('.json', '')
                    .includes(name.toLowerCase())
            );
        }

        return found;
    }

    /**
     * Loads all blueprints from the blueprints directory
     *
     * @returns {Array} Array of blueprint objects
     */
    loadAll() {
        return this._loadAllBlueprints();
    }

    /**
     * Loads all blueprints from the blueprints directory
     *
     * @private
     * @returns {Array} Array of blueprint objects
     */
    _loadAllBlueprints() {
        const blueprints = [];

        enumerateDirectory(
            this.blueprintsDir,
            (fileInfo, filePath, fileName) => {
                if (!fileName.endsWith('.json')) return;

                const blueprint = loadJsonFile(filePath);
                if (blueprint) {
                    blueprint.filename = fileName;
                    blueprint.path = filePath;
                    blueprints.push(blueprint);
                }
            }
        );

        return blueprints;
    }
}
