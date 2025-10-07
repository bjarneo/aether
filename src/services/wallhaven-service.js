import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

const WALLHAVEN_BASE_URL = 'https://wallhaven.cc/api/v1';

export class WallhavenService {
    constructor() {
        this.session = new Soup.Session();
        this.apiKey = null; // Optional API key for additional content
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Search wallpapers with various parameters
     * @param {Object} params - Search parameters
     * @param {string} params.q - Search query
     * @param {string} params.categories - Category filter (e.g., '100' for general only)
     * @param {string} params.purity - Purity filter (e.g., '100' for SFW only)
     * @param {string} params.sorting - Sort method (date_added, relevance, random, views, favorites, toplist)
     * @param {string} params.order - Sort order (desc, asc)
     * @param {number} params.page - Page number (default 1)
     * @param {string} params.atleast - Minimum resolution (e.g., '1920x1080')
     * @param {string} params.colors - Search by color (hex without #)
     * @returns {Promise<Object>} Search results with data and meta information
     */
    async search(params = {}) {
        const defaultParams = {
            purity: '100', // SFW only by default
            categories: '111', // All categories
            sorting: 'date_added',
            order: 'desc',
            page: 1,
        };

        const searchParams = { ...defaultParams, ...params };

        // Add API key if available
        if (this.apiKey) {
            searchParams.apikey = this.apiKey;
        }

        const queryString = Object.entries(searchParams)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        const url = `${WALLHAVEN_BASE_URL}/search?${queryString}`;

        return this._makeRequest(url);
    }

    /**
     * Get wallpaper details by ID
     * @param {string} wallpaperId - Wallpaper ID
     * @returns {Promise<Object>} Wallpaper details
     */
    async getWallpaper(wallpaperId) {
        let url = `${WALLHAVEN_BASE_URL}/w/${wallpaperId}`;

        if (this.apiKey) {
            url += `?apikey=${encodeURIComponent(this.apiKey)}`;
        }

        return this._makeRequest(url);
    }

    /**
     * Download wallpaper to a local file
     * @param {string} imageUrl - URL of the image to download
     * @param {string} destPath - Destination file path
     * @param {Function} onProgress - Progress callback (bytesDownloaded, totalBytes)
     * @returns {Promise<string>} Path to downloaded file
     */
    async downloadWallpaper(imageUrl, destPath, onProgress = null) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', imageUrl);

            if (!message) {
                reject(new Error('Failed to create request'));
                return;
            }

            this.session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`Download failed: ${message.get_status()}`));
                            return;
                        }

                        // Write to file
                        const file = Gio.File.new_for_path(destPath);
                        const [success] = file.replace_contents(
                            bytes.get_data(),
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );

                        if (success) {
                            resolve(destPath);
                        } else {
                            reject(new Error('Failed to write file'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }

    /**
     * Make HTTP request to wallhaven API
     * @private
     */
    async _makeRequest(url) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', url);

            if (!message) {
                reject(new Error('Failed to create request'));
                return;
            }

            this.session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`API request failed: ${message.get_status()}`));
                            return;
                        }

                        const decoder = new TextDecoder('utf-8');
                        const text = decoder.decode(bytes.get_data());
                        const json = JSON.parse(text);

                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }
}

export const wallhavenService = new WallhavenService();
