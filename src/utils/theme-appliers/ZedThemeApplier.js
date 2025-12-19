import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {copyFile, deleteFile, ensureDirectoryExists} from '../file-utils.js';

/**
 * Output filename for the Zed theme
 * @constant {string}
 */
const OUTPUT_FILENAME = 'aether.json';

/**
 * ZedThemeApplier - Handles Zed editor theme application
 *
 * Manages theme installation for Zed editor (modern code editor).
 * Installs themes to the standard Zed configuration directory.
 *
 * Features:
 * - Source file validation
 * - Standard Zed themes directory installation
 * - Theme cleanup/removal support
 *
 * File Paths:
 * - Source: ~/.config/omarchy/themes/aether/aether.zed.json
 * - Destination: ~/.config/zed/themes/aether.json
 *
 * Theme Format:
 * Zed uses JSON theme format with color definitions for syntax
 * highlighting, UI elements, and editor components.
 *
 * @class ZedThemeApplier
 *
 * @example
 * const applier = new ZedThemeApplier(themeDir);
 * const success = applier.apply();
 * if (success) {
 *     console.log('Zed theme applied successfully');
 * }
 */
export class ZedThemeApplier {
    /**
     * Initializes ZedThemeApplier with theme directory path
     * @param {string} themeDir - Path to theme directory (e.g., ~/.config/omarchy/themes/aether/)
     */
    constructor(themeDir) {
        this.themeDir = themeDir;
        this.sourceFileName = 'aether.zed.json';
        this.configDir = GLib.get_user_config_dir();
    }

    /**
     * Applies Zed theme to ~/.config/zed/themes/
     * Automatically creates themes directory if it doesn't exist
     *
     * @returns {boolean} True if theme was successfully applied, false otherwise
     */
    apply() {
        try {
            const sourcePath = GLib.build_filenamev([
                this.themeDir,
                this.sourceFileName,
            ]);

            // Check if source file exists
            const sourceFile = Gio.File.new_for_path(sourcePath);
            if (!sourceFile.query_exists(null)) {
                console.log(
                    `${this.sourceFileName} not found in theme directory, skipping Zed theme application`
                );
                return false;
            }

            // Copy to ~/.config/zed/themes/
            const success = this._copyTheme(sourcePath);

            if (success) {
                console.log('Applied Zed theme successfully');
            } else {
                console.log('Failed to apply Zed theme');
            }

            return success;
        } catch (e) {
            console.error('Error applying Zed theme:', e.message);
            return false;
        }
    }

    /**
     * Copies theme to Zed themes directory
     * @param {string} sourcePath - Path to source theme file
     * @returns {boolean} Success status
     * @private
     */
    _copyTheme(sourcePath) {
        try {
            const zedThemesPath = GLib.build_filenamev([
                this.configDir,
                'zed',
                'themes',
            ]);

            // Ensure the themes directory exists
            ensureDirectoryExists(zedThemesPath);

            // Copy the theme file
            const destPath = GLib.build_filenamev([
                zedThemesPath,
                OUTPUT_FILENAME,
            ]);
            const success = copyFile(sourcePath, destPath);

            if (success) {
                console.log(`Copied Zed theme to: ${destPath}`);
            } else {
                console.error(`Failed to copy Zed theme to: ${destPath}`);
            }

            return success;
        } catch (e) {
            console.error('Error copying Zed theme:', e.message);
            return false;
        }
    }

    /**
     * Removes Zed theme from ~/.config/zed/themes/
     * Deletes the aether.json theme file if it exists
     *
     * @returns {boolean} True if theme was successfully removed or didn't exist, false on error
     */
    clear() {
        try {
            const zedThemePath = GLib.build_filenamev([
                this.configDir,
                'zed',
                'themes',
                OUTPUT_FILENAME,
            ]);

            const themeFile = Gio.File.new_for_path(zedThemePath);
            if (!themeFile.query_exists(null)) {
                console.log('Zed theme not found, nothing to clear');
                return true;
            }

            const success = deleteFile(zedThemePath);
            if (success) {
                console.log(`Removed Zed theme: ${zedThemePath}`);
            } else {
                console.error(`Failed to remove Zed theme: ${zedThemePath}`);
            }

            return success;
        } catch (e) {
            console.error('Error clearing Zed theme:', e.message);
            return false;
        }
    }
}
