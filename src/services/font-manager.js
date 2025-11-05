import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import {ensureDirectoryExists} from '../utils/file-utils.js';

/**
 * FontManager - Service for managing system fonts
 *
 * Provides functionality for:
 * - Listing installed fonts
 * - Downloading popular monospace fonts from GitHub
 * - Installing fonts to ~/.local/share/fonts/
 * - Refreshing system font cache
 * - Applying fonts via omarchy-font-set command
 *
 * Supported fonts (18 total):
 * - JetBrains Mono, Fira Code, Cascadia Code
 * - Meslo, Hack, Source Code Pro
 * - Ubuntu Mono, Inconsolata, Iosevka
 * - Victor Mono, IBM Plex Mono, Roboto Mono
 * - DejaVu Sans Mono, Noto, Monaco
 * - Space Mono, Anonymice, Terminus
 *
 * @class FontManager
 */
export class FontManager {
    /**
     * Initializes the FontManager with HTTP client and font directory
     * @constructor
     */
    constructor() {
        this._session = new Soup.Session({timeout: 30});
        this._fontsDir = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.local',
            'share',
            'fonts',
        ]);
        this._cacheDir = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            'aether',
            'fonts',
        ]);

        // Ensure directories exist
        ensureDirectoryExists(this._fontsDir);
        ensureDirectoryExists(this._cacheDir);

        // Popular monospace fonts for terminals/editors
        this._availableFonts = [
            {
                name: 'JetBrains Mono Nerd Font',
                displayName: 'JetBrains Mono',
                family: 'JetBrainsMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/JetBrainsMono.zip',
                filename: 'JetBrainsMono.zip',
                description: 'Clean, modern monospace with ligatures',
            },
            {
                name: 'Fira Code Nerd Font',
                displayName: 'Fira Code',
                family: 'FiraCode Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/FiraCode.zip',
                filename: 'FiraCode.zip',
                description: 'Programming ligatures and clean design',
            },
            {
                name: 'Cascadia Code Nerd Font',
                displayName: 'Cascadia Code',
                family: 'CaskaydiaCove Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/CascadiaCode.zip',
                filename: 'CascadiaCode.zip',
                description: 'Microsoft\'s monospace with programming ligatures',
            },
            {
                name: 'Meslo Nerd Font',
                displayName: 'Meslo',
                family: 'MesloLGS Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Meslo.zip',
                filename: 'Meslo.zip',
                description: 'Customized Menlo with wider glyphs',
            },
            {
                name: 'Hack Nerd Font',
                displayName: 'Hack',
                family: 'Hack Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Hack.zip',
                filename: 'Hack.zip',
                description: 'Designed for source code readability',
            },
            {
                name: 'Source Code Pro Nerd Font',
                displayName: 'Source Code Pro',
                family: 'SauceCodePro Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/SourceCodePro.zip',
                filename: 'SourceCodePro.zip',
                description: 'Adobe\'s professional monospace',
            },
            {
                name: 'Ubuntu Mono Nerd Font',
                displayName: 'Ubuntu Mono',
                family: 'UbuntuMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/UbuntuMono.zip',
                filename: 'UbuntuMono.zip',
                description: 'Distinctive Ubuntu monospace style',
            },
            {
                name: 'Inconsolata Nerd Font',
                displayName: 'Inconsolata',
                family: 'Inconsolata Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Inconsolata.zip',
                filename: 'Inconsolata.zip',
                description: 'Humanist monospace for coding',
            },
            {
                name: 'Iosevka Nerd Font',
                displayName: 'Iosevka',
                family: 'Iosevka Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Iosevka.zip',
                filename: 'Iosevka.zip',
                description: 'Slender, customizable programming font',
            },
            {
                name: 'Victor Mono Nerd Font',
                displayName: 'Victor Mono',
                family: 'VictorMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/VictorMono.zip',
                filename: 'VictorMono.zip',
                description: 'Italic monospace with programming ligatures',
            },
            {
                name: 'IBM Plex Mono Nerd Font',
                displayName: 'IBM Plex Mono',
                family: 'BlexMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/IBMPlexMono.zip',
                filename: 'IBMPlexMono.zip',
                description: 'IBM\'s typeface with excellent readability',
            },
            {
                name: 'Roboto Mono Nerd Font',
                displayName: 'Roboto Mono',
                family: 'RobotoMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/RobotoMono.zip',
                filename: 'RobotoMono.zip',
                description: 'Google\'s geometric monospace font',
            },
            {
                name: 'DejaVu Sans Mono Nerd Font',
                displayName: 'DejaVu Sans Mono',
                family: 'DejaVuSansMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/DejaVuSansMono.zip',
                filename: 'DejaVuSansMono.zip',
                description: 'Wide character support, highly readable',
            },
            {
                name: 'Noto Nerd Font',
                displayName: 'Noto',
                family: 'Noto Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Noto.zip',
                filename: 'Noto.zip',
                description: 'Google\'s comprehensive font family',
            },
            {
                name: 'Monaco Nerd Font',
                displayName: 'Monaco',
                family: 'Monaco Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Monofur.zip',
                filename: 'Monofur.zip',
                description: 'Classic macOS terminal font',
            },
            {
                name: 'Space Mono Nerd Font',
                displayName: 'Space Mono',
                family: 'SpaceMono Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/SpaceMono.zip',
                filename: 'SpaceMono.zip',
                description: 'Geometric monospace with vintage feel',
            },
            {
                name: 'Anonymice Nerd Font',
                displayName: 'Anonymice',
                family: 'Anonymice Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/AnonymousPro.zip',
                filename: 'AnonymousPro.zip',
                description: 'Anonymous Pro with extended glyphs',
            },
            {
                name: 'Terminus Nerd Font',
                displayName: 'Terminus',
                family: 'Terminus Nerd Font',
                url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Terminus.zip',
                filename: 'Terminus.zip',
                description: 'Bitmap font optimized for long coding sessions',
            },
        ];
    }

    /**
     * Gets list of available fonts for download
     * @returns {Array<Object>} Array of font metadata objects
     */
    getAvailableFonts() {
        return this._availableFonts.map(font => ({
            ...font,
            installed: this._isFontInstalled(font.family),
        }));
    }

    /**
     * Checks if a font family is installed on the system
     * @param {string} fontFamily - Font family name to check
     * @returns {boolean} True if font is installed
     * @private
     */
    _isFontInstalled(fontFamily) {
        try {
            // Use fc-list to check if font is available
            const [success, stdout] = GLib.spawn_command_line_sync(
                `fc-list : family | grep -i "${fontFamily}"`
            );

            if (!success) {
                return false;
            }

            const output = new TextDecoder('utf-8').decode(stdout).trim();
            return output.length > 0;
        } catch (error) {
            console.error(`Error checking font installation: ${error.message}`);
            return false;
        }
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
     * Gets the currently configured system font
     * Reads from ~/.config/omarchy/font.conf if available
     * @returns {string|null} Current font family name or null if not configured
     */
    getCurrentFont() {
        try {
            const fontConfPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'omarchy',
                'font.conf',
            ]);

            const file = Gio.File.new_for_path(fontConfPath);
            if (!file.query_exists(null)) {
                console.log('Font config not found, checking for default');
                return null;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) {
                console.error('Failed to read font config');
                return null;
            }

            const text = new TextDecoder('utf-8').decode(contents).trim();

            // The file should contain just the font name
            if (text) {
                console.log(`Current system font: ${text}`);
                return text;
            }

            return null;
        } catch (error) {
            console.error(`Error getting current font: ${error.message}`);
            return null;
        }
    }

    /**
     * Downloads a font from URL to cache directory
     * @param {Object} font - Font metadata object
     * @returns {Promise<string>} Path to downloaded file
     * @throws {Error} If download fails
     */
    async downloadFont(font) {
        const cachePath = GLib.build_filenamev([this._cacheDir, font.filename]);
        const cacheFile = Gio.File.new_for_path(cachePath);

        // Check if already downloaded
        if (cacheFile.query_exists(null)) {
            console.log(`Font already cached: ${font.displayName}`);
            return cachePath;
        }

        console.log(`Downloading ${font.displayName} from ${font.url}...`);

        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', font.url);

            this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        if (message.status_code !== 200) {
                            reject(
                                new Error(
                                    `Download failed: HTTP ${message.status_code}`
                                )
                            );
                            return;
                        }

                        const bytes = this._session.send_and_read_finish(result);
                        const data = bytes.get_data();

                        // Save to cache
                        cacheFile.replace_contents(
                            data,
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );

                        console.log(`Downloaded ${font.displayName} to cache`);
                        resolve(cachePath);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Installs a downloaded font to ~/.local/share/fonts/
     * Extracts zip file and copies font files
     * @param {string} zipPath - Path to downloaded font zip file
     * @param {string} fontName - Display name of font for directory
     * @returns {Promise<void>}
     * @throws {Error} If installation fails
     */
    async installFont(zipPath, fontName) {
        try {
            // Create target directory for this font
            const targetDir = GLib.build_filenamev([
                this._fontsDir,
                fontName.replace(/\s+/g, '-'),
            ]);
            ensureDirectoryExists(targetDir);

            // Extract zip to target directory using unzip command
            console.log(`Installing ${fontName}...`);
            const [success, stdout, stderr] = GLib.spawn_command_line_sync(
                `unzip -o "${zipPath}" -d "${targetDir}"`
            );

            if (!success) {
                const errorMsg = new TextDecoder('utf-8').decode(stderr);
                throw new Error(`Failed to extract font: ${errorMsg}`);
            }

            console.log(`Installed ${fontName} to ${targetDir}`);

            // Refresh font cache
            await this.refreshFontCache();
        } catch (error) {
            console.error(`Error installing font: ${error.message}`);
            throw error;
        }
    }

    /**
     * Refreshes system font cache using fc-cache
     * @returns {Promise<void>}
     * @throws {Error} If cache refresh fails
     */
    async refreshFontCache() {
        return new Promise((resolve, reject) => {
            console.log('Refreshing font cache...');

            try {
                GLib.spawn_command_line_async('fc-cache -f');

                // Give it a moment to complete
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    console.log('Font cache refreshed');
                    resolve();
                    return GLib.SOURCE_REMOVE;
                });
            } catch (error) {
                reject(error);
            }
        });
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

    /**
     * Downloads and installs a font in one operation
     * @param {Object} font - Font metadata object
     * @returns {Promise<void>}
     * @throws {Error} If download or installation fails
     */
    async downloadAndInstallFont(font) {
        try {
            const zipPath = await this.downloadFont(font);
            await this.installFont(zipPath, font.displayName);
        } catch (error) {
            console.error(
                `Error downloading and installing font: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Removes a font from the system
     * @param {string} fontName - Display name of font to remove
     * @returns {Promise<void>}
     */
    async removeFont(fontName) {
        try {
            const targetDir = GLib.build_filenamev([
                this._fontsDir,
                fontName.replace(/\s+/g, '-'),
            ]);
            const dir = Gio.File.new_for_path(targetDir);

            if (dir.query_exists(null)) {
                // Remove directory recursively
                const [success, stdout, stderr] = GLib.spawn_command_line_sync(
                    `rm -rf "${targetDir}"`
                );

                if (!success) {
                    const errorMsg = new TextDecoder('utf-8').decode(stderr);
                    throw new Error(`Failed to remove font: ${errorMsg}`);
                }

                console.log(`Removed font: ${fontName}`);
                await this.refreshFontCache();
            }
        } catch (error) {
            console.error(`Error removing font: ${error.message}`);
            throw error;
        }
    }
}
