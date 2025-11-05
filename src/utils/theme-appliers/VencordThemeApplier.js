import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {copyVencordTheme} from '../service-manager.js';

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
            const successCount = copyVencordTheme(sourcePath);

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
     * Removes Vencord theme from all detected installations
     * Note: Currently not implemented - Vencord themes don't require removal
     * Users can simply disable/delete the theme file manually if needed
     *
     * @returns {boolean} Always returns true (no-op)
     */
    clear() {
        // Vencord themes don't require special cleanup
        // Users can manually delete theme files if needed
        console.log('Vencord theme cleanup not required (user can delete theme files manually)');
        return true;
    }
}
