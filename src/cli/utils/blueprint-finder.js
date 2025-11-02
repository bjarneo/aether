import {enumerateDirectory, loadJsonFile} from '../../utils/file-utils.js';
export class BlueprintFinder {
    constructor(blueprintsDir) {
        this.blueprintsDir = blueprintsDir;
    }

    findByName(name) {
        const blueprints = this._loadAllBlueprints();
        let found = blueprints.find(
            bp => bp.name && bp.name.toLowerCase() === name.toLowerCase()
        );
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

    loadAll() {
        return this._loadAllBlueprints();
    }

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
