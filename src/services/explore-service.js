import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

/**
 * Service for managing community blueprints
 */
export class ExploreService {
    constructor() {
        this._session = new Soup.Session();
        // In a real app, this would be an API endpoint
        // For now, we'll use a mock delay and return static data
        this._mockData = [
            {
                id: 'community-1',
                name: 'Cyberpunk Neon',
                author: 'NeonRider',
                downloads: 1243,
                timestamp: Date.now() - 86400000 * 2,
                palette: {
                    wallpaper: null, // Remote wallpaper handling is complex, ignoring for now
                    colors: [
                        '#0f0f1e', '#ff0055', '#00ffcc', '#f0f0f0', '#bd93f9', '#ffb86c', '#8be9fd', '#50fa7b',
                        '#1f1f2e', '#ff3377', '#33ffdd', '#ffffff', '#cfa3fa', '#ffc87c', '#9bf9fd', '#60fa8b'
                    ],
                    lightMode: false
                }
            },
            {
                id: 'community-2',
                name: 'Nordic Frost',
                author: 'ArcticWolf',
                downloads: 892,
                timestamp: Date.now() - 86400000 * 5,
                palette: {
                    wallpaper: null,
                    colors: [
                        '#2e3440', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0',
                        '#3b4252', '#d08770', '#a3be8c', '#ebcb8b', '#5e81ac', '#b48ead', '#8fbcbb', '#eceff4'
                    ],
                    lightMode: false
                }
            },
            {
                id: 'community-3',
                name: 'Sunset Vibes',
                author: 'SolarFlare',
                downloads: 567,
                timestamp: Date.now() - 86400000 * 10,
                palette: {
                    wallpaper: null,
                    colors: [
                        '#2d1b2e', '#ff6b6b', '#ff9e64', '#ffe66d', '#4ecdc4', '#f7fff7', '#ff6b6b', '#ffe66d',
                        '#3d2b3e', '#ff8b8b', '#ffbe84', '#fff68d', '#6eede4', '#ffffff', '#ff8b8b', '#fff68d'
                    ],
                    lightMode: false
                }
            }
        ];
    }

    /**
     * Fetches community blueprints
     * @returns {Promise<Array>} Array of blueprint objects
     */
    async fetchBlueprints() {
        // Simulate network delay
        return new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
                resolve(this._mockData);
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    /**
     * Publishes a blueprint to the community
     * @param {Object} blueprint - The blueprint to publish
     * @returns {Promise<boolean>} Success status
     */
    async publishBlueprint(blueprint) {
        // Simulate network delay
        return new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                console.log(`Published blueprint: ${blueprint.name}`);
                resolve(true);
                return GLib.SOURCE_REMOVE;
            });
        });
    }
}

export const exploreService = new ExploreService();

