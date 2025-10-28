import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {enumerateDirectory, loadJsonFile} from './utils/file-utils.js';
import {ConfigWriter} from './utils/ConfigWriter.js';

/**
 * CLI interface for Aether
 */
export class AetherCLI {
    constructor() {
        this.blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);
    }

    /**
     * Prints a message directly to stdout
     */
    _print(message) {
        print(message);
    }

    /**
     * Maps palette colors to color roles
     */
    _mapColorsToRoles(palette) {
        // Same mapping as ColorSynthesizer._createColorAssignments()
        return {
            background: palette[0],
            foreground: palette[15],
            color0: palette[0],
            color1: palette[1],
            color2: palette[2],
            color3: palette[3],
            color4: palette[4],
            color5: palette[5],
            color6: palette[6],
            color7: palette[7],
            color8: palette[8],
            color9: palette[9],
            color10: palette[10],
            color11: palette[11],
            color12: palette[12],
            color13: palette[13],
            color14: palette[14],
            color15: palette[15],
        };
    }

    /**
     * Finds a blueprint by name
     */
    _findBlueprintByName(name) {
        const blueprints = [];

        enumerateDirectory(this.blueprintsDir, (fileInfo, filePath, fileName) => {
            if (!fileName.endsWith('.json')) return;

            const blueprint = loadJsonFile(filePath);
            if (blueprint) {
                blueprint.filename = fileName;
                blueprint.path = filePath;
                blueprints.push(blueprint);
            }
        });

        // Try exact match first
        let found = blueprints.find(
            bp => bp.name && bp.name.toLowerCase() === name.toLowerCase()
        );

        // Try partial match on filename if no exact match
        if (!found) {
            found = blueprints.find(bp =>
                bp.filename.toLowerCase().replace('.json', '').includes(name.toLowerCase())
            );
        }

        return found;
    }

    /**
     * Applies a blueprint by name
     */
    applyBlueprint(name) {
        if (!name) {
            this._print('Error: Blueprint name is required');
            this._print('Usage: ./aether apply-blue-print <name>');
            return false;
        }

        // Find the blueprint
        const blueprint = this._findBlueprintByName(name);

        if (!blueprint) {
            this._print(`Error: Blueprint "${name}" not found`);
            this.listBlueprints();
            return false;
        }

        try {
            // Extract data from blueprint
            const palette = blueprint.palette;
            if (!palette || !palette.colors) {
                this._print('Error: Blueprint has no color palette');
                return false;
            }

            // Map colors to roles
            const colorRoles = this._mapColorsToRoles(palette.colors);

            // Get settings, defaulting to sensible values
            const settings = blueprint.settings || {};
            const lightMode = palette.lightMode || settings.lightMode || false;
            const appOverrides = palette.appOverrides || {};

            const configWriter = new ConfigWriter();
            configWriter.applyTheme(
                colorRoles,
                palette.wallpaper,
                settings,
                lightMode,
                appOverrides
            );

            // Exit immediately - async operations continue in background
            return true;
        } catch (e) {
            this._print(`Error applying blueprint: ${e.message}`);
            return false;
        }
    }

    /**
     * Lists all saved blueprints
     */
    listBlueprints() {
        const blueprints = [];

        // Check if blueprints directory exists
        const dir = Gio.File.new_for_path(this.blueprintsDir);
        if (!dir.query_exists(null)) {
            this._print('No blueprints directory found.');
            this._print(`Directory: ${this.blueprintsDir}`);
            return;
        }

        // Enumerate all blueprint files
        enumerateDirectory(this.blueprintsDir, (fileInfo, filePath, fileName) => {
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
            this._print('No blueprints found.');
            this._print(`Directory: ${this.blueprintsDir}`);
            return;
        }

        // Print blueprints
        blueprints.forEach((blueprint) => {
            const name = blueprint.name || blueprint.filename.replace('.json', '');
            this._print(`${name}`);
        });
    }

    /**
     * Shows help message
     */
    showHelp() {
        this._print(`
Aether - Universal Desktop Synthesizer

Usage:
  ./aether [OPTIONS]
  ./aether blue-prints
  ./aether apply-blue-print <name>

Options:
  -h, --help                Show this help message
  -w, --wallpaper=FILE      Path to wallpaper image to load on startup

Commands:
  blue-prints                List all saved blueprint themes
  apply-blue-print <name>    Apply a blueprint by name

Examples:
  ./aether                                    # Open the GUI application
  ./aether --wallpaper ~/Pictures/wall.png   # Open with a specific wallpaper
  ./aether blue-prints                       # List all saved blueprints
  ./aether apply-blue-print nord             # Apply the "nord" blueprint
`);
    }

    /**
     * Process command line arguments and run appropriate command
     */
    run(args) {
        if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
            this.showHelp();
            return;
        }

        const command = args[0];
        if (command === 'blue-prints' || command === 'blueprints') {
            this.listBlueprints();
        } else if (command === 'apply-blue-print') {
            const blueprintName = args[1];
            this.applyBlueprint(blueprintName);
        } else {
            this._print(`Unknown command: ${command}`);
            this._print('Run "./aether --help" for usage information.');
        }
    }
}

// Run the CLI when executed directly
const cli = new AetherCLI();
// ARGV contains all arguments passed to the script
const args = typeof ARGV !== 'undefined' ? ARGV : [];
cli.run(args);
