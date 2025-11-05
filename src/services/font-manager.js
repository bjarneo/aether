import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * FontManager - Service for managing system fonts
 *
 * Provides functionality for:
 * - Listing installed monospace fonts
 * - Detecting current system font
 * - Applying fonts via omarchy-font-set command
 * - Getting fonts directory path
 *
 * @class FontManager
 */
export class FontManager {
    /**
     * Initializes the FontManager with font directory
     * @constructor
     */
    constructor() {
        this._fontsDir = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.local',
            'share',
            'fonts',
        ]);
    }

    /**
     * Gets list of currently installed monospace fonts
     * @returns {Array<string>} Array of installed font family names
     */
    getInstalledFonts() {
        try {
            const [success, stdout] = GLib.spawn_command_line_sync(
                'fc-list :spacing=100 family'
            );

            if (!success) {
                console.error('Failed to list installed fonts');
                return [];
            }

            const output = new TextDecoder('utf-8').decode(stdout);
            const fonts = new Set();

            output.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed) {
                    // Extract first font family name (before comma if multiple)
                    const fontName = trimmed.split(',')[0].trim();
                    if (fontName) {
                        fonts.add(fontName);
                    }
                }
            });

            return Array.from(fonts).sort();
        } catch (error) {
            console.error(`Error listing fonts: ${error.message}`);
            return [];
        }
    }

    /**
     * Gets the currently configured system monospace font
     * Tries multiple methods in order:
     * 1. Omarchy font.conf
     * 2. GNOME/GTK monospace font setting
     * 3. System default monospace
     * @returns {string|null} Current font family name or null if not configured
     */
    getCurrentFont() {
        // Try 1: Omarchy font.conf
        try {
            const fontConfPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'omarchy',
                'font.conf',
            ]);

            const file = Gio.File.new_for_path(fontConfPath);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const text = new TextDecoder('utf-8').decode(contents).trim();
                    if (text) {
                        console.log(`Current font (omarchy): ${text}`);
                        return text;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading omarchy font.conf: ${error.message}`);
        }

        // Try 2: GNOME/GTK monospace font setting
        try {
            const [success, stdout] = GLib.spawn_command_line_sync(
                'gsettings get org.gnome.desktop.interface monospace-font-name'
            );

            if (success) {
                const output = new TextDecoder('utf-8')
                    .decode(stdout)
                    .trim()
                    .replace(/^'|'$/g, ''); // Remove quotes

                // Parse "Font Name 12" to just "Font Name"
                const fontFamily = output.replace(/\s+\d+$/, '').trim();

                if (fontFamily) {
                    console.log(`Current font (GNOME): ${fontFamily}`);
                    return fontFamily;
                }
            }
        } catch (error) {
            console.error(`Error getting GNOME font: ${error.message}`);
        }

        // Try 3: Check fontconfig default monospace
        try {
            const [success, stdout] = GLib.spawn_command_line_sync(
                'fc-match monospace family'
            );

            if (success) {
                const output = new TextDecoder('utf-8').decode(stdout).trim();
                if (output) {
                    console.log(`Current font (fontconfig): ${output}`);
                    return output;
                }
            }
        } catch (error) {
            console.error(`Error getting fontconfig default: ${error.message}`);
        }

        console.log('No system font configured');
        return null;
    }

    /**
     * Gets the fonts directory path
     * @returns {string} Path to fonts directory
     */
    getFontsDirectory() {
        return this._fontsDir;
    }


    /**
     * Sets the system font using omarchy-font-set command
     * @param {string} fontFamily - Font family name (e.g., "JetBrainsMono Nerd Font")
     * @returns {Promise<void>}
     * @throws {Error} If font application fails
     */
    async setFont(fontFamily) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Setting font: ${fontFamily}`);
                const command = `omarchy-font-set "${fontFamily}"`;

                GLib.spawn_command_line_async(command);

                // Give it a moment to apply
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                    console.log(`Font set to: ${fontFamily}`);
                    resolve();
                    return GLib.SOURCE_REMOVE;
                });
            } catch (error) {
                console.error(`Error setting font: ${error.message}`);
                reject(error);
            }
        });
    }

}
