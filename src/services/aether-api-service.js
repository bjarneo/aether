import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import {
    loadJsonFile,
    saveJsonFile,
    ensureDirectoryExists,
} from '../utils/file-utils.js';

const AETHER_API_BASE_URL = 'https://aethr.no/api';

/**
 * AetherApiService - Service for interacting with the Aether community API
 *
 * Handles:
 * - API key management (save/load/validate)
 * - Posting blueprints to the community as drafts
 * - Uploading wallpaper images with blueprints
 *
 * @class AetherApiService
 */
class AetherApiService {
    constructor() {
        this.session = new Soup.Session();
        this._apiKey = null;
        this._configPath = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'aether-api.json',
        ]);
        this._loadConfig();
    }

    /**
     * Load API configuration from disk
     * @private
     */
    _loadConfig() {
        const config = loadJsonFile(this._configPath, {apiKey: ''});
        this._apiKey = config.apiKey || '';
    }

    /**
     * Save API configuration to disk
     * @private
     */
    _saveConfig() {
        const configDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
        ]);
        ensureDirectoryExists(configDir);
        saveJsonFile(this._configPath, {apiKey: this._apiKey});
    }

    /**
     * Check if an API key is configured
     * @returns {boolean} True if API key is set
     */
    hasApiKey() {
        return this._apiKey && this._apiKey.length > 0;
    }

    /**
     * Get the current API key
     * @returns {string} The API key or empty string
     */
    getApiKey() {
        return this._apiKey || '';
    }

    /**
     * Set the API key and persist to disk
     * @param {string} apiKey - The API key to save
     */
    setApiKey(apiKey) {
        this._apiKey = (apiKey || '').trim();
        this._saveConfig();
    }

    /**
     * Read file contents as Uint8Array
     * @param {string} filePath - Path to the file
     * @returns {{contents: Uint8Array, error: string|null}} File contents and error message
     * @private
     */
    _readFileContents(filePath) {
        try {
            const file = Gio.File.new_for_path(filePath);
            const [success, contents] = file.load_contents(null);
            if (success) {
                return {contents, error: null};
            }
            return {contents: null, error: 'Failed to read file'};
        } catch (e) {
            console.error(`Failed to read file ${filePath}:`, e.message);
            return {contents: null, error: e.message};
        }
    }

    /**
     * Get MIME type for an image file
     * @param {string} filePath - Path to the file
     * @returns {string} MIME type
     * @private
     */
    _getImageMimeType(filePath) {
        const lower = filePath.toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
            return 'image/jpeg';
        if (lower.endsWith('.webp')) return 'image/webp';
        if (lower.endsWith('.gif')) return 'image/gif';
        return 'application/octet-stream';
    }

    /**
     * Build multipart form data body manually
     * @param {string} boundary - Multipart boundary string
     * @param {Object} blueprintData - Blueprint JSON data
     * @param {string|null} wallpaperPath - Path to wallpaper file or null
     * @returns {{body: Uint8Array|null, error: string|null}} The multipart body and error
     * @private
     */
    _buildMultipartBody(boundary, blueprintData, wallpaperPath) {
        const encoder = new TextEncoder();
        const parts = [];

        // Add JSON data part
        const jsonPart = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="data"',
            'Content-Type: application/json',
            '',
            JSON.stringify(blueprintData),
        ].join('\r\n');
        parts.push(encoder.encode(jsonPart));

        // Add wallpaper part if present
        if (wallpaperPath) {
            const {contents: imageData, error} =
                this._readFileContents(wallpaperPath);
            if (error) {
                return {
                    body: null,
                    error: `Failed to read wallpaper: ${error}`,
                };
            }
            if (imageData) {
                const filename = GLib.path_get_basename(wallpaperPath);
                const mimeType = this._getImageMimeType(wallpaperPath);

                const imageHeader = [
                    '',
                    `--${boundary}`,
                    `Content-Disposition: form-data; name="wallpaperImage"; filename="${filename}"`,
                    `Content-Type: ${mimeType}`,
                    '',
                    '',
                ].join('\r\n');
                parts.push(encoder.encode(imageHeader));
                parts.push(imageData);
            }
        }

        // Add closing boundary
        const closing = encoder.encode(`\r\n--${boundary}--\r\n`);
        parts.push(closing);

        // Combine all parts
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
            result.set(part, offset);
            offset += part.length;
        }

        return {body: result, error: null};
    }

    /**
     * Post a blueprint to the Aether community as a draft
     * Supports uploading wallpaper image if present in the blueprint
     * @param {Object} blueprint - The blueprint data
     * @returns {Promise<{success: boolean, id?: string, message: string}>}
     */
    async postBlueprint(blueprint) {
        if (!this.hasApiKey()) {
            return {
                success: false,
                message:
                    'No API key configured. Go to Settings to add your aethr.no API key.',
            };
        }

        // Prepare blueprint data for API
        const blueprintData = {
            name: blueprint.name,
            palette: {
                colors: blueprint.palette?.colors || [],
                lightMode: blueprint.palette?.lightMode || false,
                appOverrides: blueprint.palette?.appOverrides || {},
            },
            isDraft: true, // Always create as draft
        };

        // Add optional fields if present
        if (blueprint.description) {
            blueprintData.description = blueprint.description;
        }
        if (blueprint.tags && blueprint.tags.length > 0) {
            blueprintData.tags = blueprint.tags;
        }
        if (blueprint.timestamp) {
            blueprintData.timestamp = blueprint.timestamp;
        }
        if (blueprint.settings) {
            blueprintData.settings = blueprint.settings;
        }

        // Check if we have a wallpaper to upload
        const wallpaperPath = blueprint.palette?.wallpaper;
        const hasWallpaper =
            wallpaperPath &&
            GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS);

        return new Promise(resolve => {
            const url = `${AETHER_API_BASE_URL}/blueprints`;
            const message = Soup.Message.new('POST', url);

            if (!message) {
                resolve({
                    success: false,
                    message:
                        'Failed to create network request. Please check your internet connection.',
                });
                return;
            }

            // Set Authorization header
            message
                .get_request_headers()
                .append('Authorization', `Bearer ${this._apiKey}`);

            let bodyBytes;
            let contentType;

            if (hasWallpaper) {
                // Use multipart/form-data for uploading with wallpaper
                const boundary = `----AetherBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
                contentType = `multipart/form-data; boundary=${boundary}`;
                const result = this._buildMultipartBody(
                    boundary,
                    blueprintData,
                    wallpaperPath
                );
                if (result.error) {
                    resolve({
                        success: false,
                        message: result.error,
                    });
                    return;
                }
                bodyBytes = result.body;
            } else {
                // Use simple JSON for blueprints without wallpaper
                contentType = 'application/json';
                const jsonBody = JSON.stringify(blueprintData);
                bodyBytes = new TextEncoder().encode(jsonBody);
            }

            message.get_request_headers().append('Content-Type', contentType);
            message.set_request_body_from_bytes(
                contentType,
                new GLib.Bytes(bodyBytes)
            );

            this.session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const responseBytes =
                            session.send_and_read_finish(result);
                        const status = message.get_status();
                        const decoder = new TextDecoder('utf-8');
                        const text = decoder.decode(responseBytes.get_data());

                        let json;
                        try {
                            json = JSON.parse(text);
                        } catch (e) {
                            json = {message: text || 'Unknown error'};
                        }

                        if (
                            status === Soup.Status.CREATED ||
                            status === Soup.Status.OK
                        ) {
                            resolve({
                                success: true,
                                id: json.id,
                                message:
                                    json.message ||
                                    'Blueprint posted successfully',
                            });
                        } else {
                            // Pass through the server error message
                            const errorMessage =
                                json.message ||
                                json.error ||
                                `Request failed (HTTP ${status})`;
                            console.error(
                                `API Error (${status}):`,
                                errorMessage
                            );
                            resolve({
                                success: false,
                                message: errorMessage,
                            });
                        }
                    } catch (e) {
                        console.error('Error posting blueprint:', e.message);
                        resolve({
                            success: false,
                            message: e.message,
                        });
                    }
                }
            );
        });
    }
}

// Export singleton instance
export const aetherApiService = new AetherApiService();
