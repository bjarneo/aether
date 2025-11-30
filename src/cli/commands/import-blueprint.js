import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import {BlueprintService} from '../../services/BlueprintService.js';
import {saveJsonFile} from '../../utils/file-utils.js';

/**
 * Command handler for importing blueprint themes from URLs or files
 * Supports downloading from remote URLs and importing local files
 */
export class ImportBlueprintCommand {
    /**
     * Executes the import-blueprint command
     *
     * @param {string} source - URL or file path of the blueprint to import
     * @param {boolean} autoApply - Whether to automatically apply after import
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    static async execute(source, autoApply = false) {
        if (!source) {
            print('Error: Blueprint source (URL or file path) is required');
            print('Usage: aether --import-blueprint <url|path> [--auto-apply]');
            return false;
        }

        try {
            let blueprintData;
            let blueprintName;

            // Check if source is a URL
            if (source.startsWith('http://') || source.startsWith('https://')) {
                print(`Downloading blueprint from: ${source}`);
                const result = await this._downloadBlueprint(source);
                if (!result) {
                    return false;
                }
                blueprintData = result.data;
                blueprintName = result.name;
            } else {
                // Local file import
                print(`Importing blueprint from file: ${source}`);
                const result = this._loadLocalBlueprint(source);
                if (!result) {
                    return false;
                }
                blueprintData = result.data;
                blueprintName = result.name;
            }

            // Validate blueprint structure
            const blueprintService = new BlueprintService();
            if (!blueprintService.validateBlueprint(blueprintData)) {
                print('Error: Blueprint has invalid structure');
                print('Required: palette.colors array with 16 hex colors');
                return false;
            }

            // Save blueprint to blueprints directory
            const savedPath = this._saveImportedBlueprint(
                blueprintData,
                blueprintName
            );
            if (!savedPath) {
                return false;
            }

            print(`✓ Blueprint imported successfully: ${blueprintName}`);
            print(`  Saved to: ${savedPath}`);

            // Auto-apply if requested
            if (autoApply) {
                print('\nApplying imported blueprint...');
                const {ApplyBlueprintCommand} = await import(
                    './apply-blueprint.js'
                );
                return ApplyBlueprintCommand.execute(blueprintName);
            }

            return true;
        } catch (e) {
            print(`Error: Failed to import blueprint: ${e.message}`);
            return false;
        }
    }

    /**
     * Downloads a blueprint from a URL
     * @param {string} url - URL to download from
     * @returns {Promise<Object|null>} Object with {data, name} or null on failure
     * @private
     */
    static async _downloadBlueprint(url) {
        return new Promise((resolve, reject) => {
            try {
                const session = new Soup.Session();
                const message = Soup.Message.new('GET', url);

                if (!message) {
                    reject(new Error(`Invalid URL: ${url}`));
                    return;
                }

                // Send request
                session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (session, result) => {
                        try {
                            const bytes = session.send_and_read_finish(result);
                            const status = message.get_status();

                            if (status !== 200) {
                                reject(
                                    new Error(
                                        `HTTP ${status}: Failed to download blueprint`
                                    )
                                );
                                return;
                            }

                            // Parse JSON response
                            const data = bytes.get_data();
                            if (!data) {
                                reject(new Error('Empty response from server'));
                                return;
                            }

                            const text = new TextDecoder('utf-8').decode(data);
                            const blueprintData = JSON.parse(text);

                            // Extract name from blueprint or URL
                            const name =
                                blueprintData.name ||
                                this._extractNameFromUrl(url);

                            resolve({data: blueprintData, name});
                        } catch (error) {
                            reject(
                                new Error(
                                    `Failed to parse blueprint: ${error.message}`
                                )
                            );
                        }
                    }
                );
            } catch (error) {
                reject(new Error(`Download failed: ${error.message}`));
            }
        });
    }

    /**
     * Loads a blueprint from a local file
     * @param {string} filePath - Path to local blueprint file
     * @returns {Object|null} Object with {data, name} or null on failure
     * @private
     */
    static _loadLocalBlueprint(filePath) {
        try {
            const file = Gio.File.new_for_path(filePath);

            if (!file.query_exists(null)) {
                print(`Error: File not found: ${filePath}`);
                return null;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) {
                print(`Error: Failed to read file: ${filePath}`);
                return null;
            }

            const text = new TextDecoder('utf-8').decode(contents);
            const blueprintData = JSON.parse(text);

            // Extract name from blueprint or filename
            const name =
                blueprintData.name ||
                GLib.path_get_basename(filePath).replace('.json', '');

            return {data: blueprintData, name};
        } catch (error) {
            print(`Error: Failed to load blueprint: ${error.message}`);
            return null;
        }
    }

    /**
     * Saves imported blueprint to blueprints directory
     * @param {Object} blueprintData - Blueprint data to save
     * @param {string} name - Name for the blueprint
     * @returns {string|null} Path where blueprint was saved or null on failure
     * @private
     */
    static _saveImportedBlueprint(blueprintData, name) {
        try {
            const blueprintsDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'blueprints',
            ]);

            // Ensure name is in blueprint data
            blueprintData.name = name;

            // Add/update timestamp
            blueprintData.timestamp = Date.now();

            // Generate filename with timestamp to avoid conflicts
            const timestamp = Date.now();
            const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
            const filename = `${safeName}_imported_${timestamp}.json`;
            const filePath = GLib.build_filenamev([blueprintsDir, filename]);

            // Save blueprint
            saveJsonFile(filePath, blueprintData);

            return filePath;
        } catch (error) {
            print(`Error: Failed to save blueprint: ${error.message}`);
            return null;
        }
    }

    /**
     * Extracts a name from a URL
     * @param {string} url - URL to extract name from
     * @returns {string} Extracted name
     * @private
     */
    static _extractNameFromUrl(url) {
        try {
            const urlObj = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const path = urlObj.get_path();
            const filename = GLib.path_get_basename(path);
            return filename.replace('.json', '') || 'imported_blueprint';
        } catch (error) {
            return 'imported_blueprint';
        }
    }
}
