import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {copyFile, ensureDirectoryExists} from '../file-utils.js';

/**
 * Output filename for the Vencord theme
 * @constant {string}
 */
const OUTPUT_FILENAME = 'aether.theme.css';

/**
 * All possible Vencord/Vesktop theme directories
 * @constant {string[][]}
 */
const VENCORD_THEME_PATHS = [
    // Vesktop (Flatpak)
    ['.var', 'app', 'dev.vencord.Vesktop', 'config', 'vesktop', 'themes'],
    // Vesktop (Native/AUR/AppImage)
    ['.config', 'Vesktop', 'themes'],
    // Vencord (Native/AUR)
    ['.config', 'Vencord', 'themes'],
    // Vencord (Flatpak Discord)
    ['.var', 'app', 'com.discordapp.Discord', 'config', 'Vencord', 'themes'],
];

/**
 * VencordThemeApplier - Handles Vencord/Vesktop Discord theme application
 *
 * Manages theme installation for Vencord (Discord modding client) across
 * multiple installation types including Flatpak, native, AUR, and AppImage.
 *
 * Features:
 * - Multi-location support (Vesktop Flatpak, Vesktop Native, Vencord Native, Discord Flatpak)
 * - Automatic detection of installed Vencord instances
 * - Source file validation
 * - Copy to all detected installations
 *
 * File Paths:
 * - Source: ~/.config/omarchy/themes/aether/vencord.theme.css
 * - Destinations:
 *   - Vesktop (Flatpak): ~/.var/app/dev.vencord.Vesktop/config/vesktop/themes/aether.theme.css
 *   - Vesktop (Native): ~/.config/Vesktop/themes/aether.theme.css
 *   - Vencord (Native): ~/.config/Vencord/themes/aether.theme.css
 *   - Vencord (Flatpak Discord): ~/.var/app/com.discordapp.Discord/config/Vencord/themes/aether.theme.css
 *
 * @class VencordThemeApplier
 *
 * @example
 * const applier = new VencordThemeApplier(themeDir);
 * const count = applier.apply(); // Returns number of successful installations
 * console.log(`Theme installed to ${count} Vencord instance(s)`);
 */
export class VencordThemeApplier {
    /**
     * Initializes VencordThemeApplier with theme directory path
     * @param {string} themeDir - Path to theme directory (e.g., ~/.config/omarchy/themes/aether/)
     */
    constructor(themeDir) {
        this.themeDir = themeDir;
        this.sourceFileName = 'vencord.theme.css';
    }

    /**
     * Applies Vencord theme to all detected installations
     * Automatically detects and installs to all existing Vencord/Vesktop instances
     *
     * @returns {number} Number of successful installations (0 if source file missing)
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
                    `${this.sourceFileName} not found in theme directory, skipping Vencord theme application`
                );
                return 0;
            }

            // Copy to all existing Vencord/Vesktop installations
            const successCount = this._copyToAllInstallations(sourcePath);

            if (successCount > 0) {
                console.log(
                    `Applied Vencord theme to ${successCount} installation(s)`
                );
            } else {
                console.log(
                    'No Vencord/Vesktop installations detected. Skipping theme application.'
                );
            }

            return successCount;
        } catch (e) {
            console.error('Error applying Vencord theme:', e.message);
            return 0;
        }
    }

    /**
     * Copies theme to all existing Vencord/Vesktop installations
     * @param {string} sourcePath - Path to source theme file
     * @returns {number} Number of successful copies
     * @private
     */
    _copyToAllInstallations(sourcePath) {
        const homeDir = GLib.get_home_dir();
        let successCount = 0;

        VENCORD_THEME_PATHS.forEach(pathComponents => {
            try {
                const themePath = GLib.build_filenamev([
                    homeDir,
                    ...pathComponents,
                ]);
                const parentDir = GLib.path_get_dirname(themePath);
                const parentFile = Gio.File.new_for_path(parentDir);

                // Only copy if the parent config directory exists (app is installed)
                if (!parentFile.query_exists(null)) {
                    return;
                }

                // Ensure the themes directory exists
                ensureDirectoryExists(themePath);

                // Copy the theme file
                const destPath = GLib.build_filenamev([
                    themePath,
                    OUTPUT_FILENAME,
                ]);
                const success = copyFile(sourcePath, destPath);

                if (success) {
                    console.log(`Copied Vencord theme to: ${destPath}`);
                    successCount++;
                } else {
                    console.error(
                        `Failed to copy Vencord theme to: ${destPath}`
                    );
                }
            } catch (e) {
                console.error(
                    `Error copying Vencord theme to ${pathComponents.join('/')}:`,
                    e.message
                );
            }
        });

        return successCount;
    }

    /**
     * Removes Vencord theme from all detected installations
     * Note: Currently not implemented - Vencord themes don't require removal
     * Users can simply disable/delete the theme file manually if needed
     *
     * @returns {boolean} Always returns true (no-op)
     */
    clear() {
        // Vencord themes don't require special cleanup
        // Users can manually delete theme files if needed
        console.log(
            'Vencord theme cleanup not required (user can delete theme files manually)'
        );
        return true;
    }
}
