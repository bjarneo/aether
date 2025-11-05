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
     * Reads from config files that omarchy-font-set modifies:
     * 1. ~/.config/kitty/kitty.conf (font_family)
     * 2. ~/.config/alacritty/alacritty.toml (family = "...")
     * 3. ~/.config/fontconfig/fonts.conf (monospace mapping)
     * 4. System default (fc-match monospace)
     * @returns {string|null} Current font family name or null if not configured
     */
    getCurrentFont() {
        // Try 1: kitty.conf (simplest to parse)
        try {
            const kittyConfPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'kitty',
                'kitty.conf',
            ]);

            const file = Gio.File.new_for_path(kittyConfPath);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const text = new TextDecoder('utf-8').decode(contents);
                    // Look for line: font_family Font Name
                    const match = text.match(/^font_family\s+(.+)$/m);
                    if (match && match[1]) {
                        const fontName = match[1].trim();
                        console.log(`Current font (kitty): ${fontName}`);
                        return fontName;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading kitty.conf: ${error.message}`);
        }

        // Try 2: alacritty.toml
        try {
            const alacrittyTomlPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'alacritty',
                'alacritty.toml',
            ]);

            const file = Gio.File.new_for_path(alacrittyTomlPath);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const text = new TextDecoder('utf-8').decode(contents);
                    // Look for line: family = "Font Name"
                    const match = text.match(/family\s*=\s*"([^"]+)"/);
                    if (match && match[1]) {
                        const fontName = match[1].trim();
                        console.log(`Current font (alacritty): ${fontName}`);
                        return fontName;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading alacritty.toml: ${error.message}`);
        }

        // Try 3: fontconfig fonts.conf (XML parsing with xmlstarlet)
        try {
            const fontsConfPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'fontconfig',
                'fonts.conf',
            ]);

            const file = Gio.File.new_for_path(fontsConfPath);
            if (file.query_exists(null)) {
                // Use xmlstarlet to extract the monospace font mapping
                const [success, stdout] = GLib.spawn_command_line_sync(
                    `xmlstarlet sel -t -v '//match[@target="pattern"][test/string="monospace"]/edit[@name="family"]/string' "${fontsConfPath}"`
                );

                if (success) {
                    const fontName = new TextDecoder('utf-8')
                        .decode(stdout)
                        .trim();
                    if (fontName) {
                        console.log(`Current font (fontconfig): ${fontName}`);
                        return fontName;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading fonts.conf: ${error.message}`);
        }

        // Try 4: System default (fc-match monospace)
        try {
            const [success, stdout] = GLib.spawn_command_line_sync(
                'fc-match monospace family'
            );

            if (success) {
                const output = new TextDecoder('utf-8').decode(stdout).trim();
                if (output) {
                    console.log(`Current font (system default): ${output}`);
                    return output;
                }
            }
        } catch (error) {
            console.error(`Error getting system default font: ${error.message}`);
        }

        console.log('No font configured');
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
