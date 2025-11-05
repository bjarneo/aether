import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {ensureDirectoryExists, copyFile} from '../file-utils.js';

/**
 * GtkThemeApplier - Handles GTK3/GTK4 theme application
 *
 * Copies generated gtk.css from the Aether theme directory to the user's
 * GTK configuration directories, enabling system-wide GTK theming.
 *
 * Features:
 * - Copies to both GTK3 (~/.config/gtk-3.0/) and GTK4 (~/.config/gtk-4.0/)
 * - Creates backup of existing gtk.css files
 * - Sets proper file permissions (0644)
 * - Validates source file existence before copying
 *
 * File Flow:
 * Source: ~/.config/omarchy/themes/aether/gtk.css
 * ↓
 * GTK3: ~/.config/gtk-3.0/gtk.css
 * GTK4: ~/.config/gtk-4.0/gtk.css
 *
 * @example
 * const applier = new GtkThemeApplier();
 * applier.apply('/path/to/theme/gtk.css');
 * // GTK theme applied to both GTK3 and GTK4
 */
export class GtkThemeApplier {
    /**
     * Creates a new GtkThemeApplier instance
     */
    constructor() {
        this.configDir = GLib.get_user_config_dir();
    }

    /**
     * Applies GTK theme by copying gtk.css to GTK3/GTK4 config directories
     * @param {string} gtkSourcePath - Path to source gtk.css file
     * @returns {boolean} True if successful, false otherwise
     */
    apply(gtkSourcePath) {
        try {
            // Check if source file exists
            const sourceFile = Gio.File.new_for_path(gtkSourcePath);
            if (!sourceFile.query_exists(null)) {
                console.log(
                    'gtk.css not found in theme directory, skipping GTK theme application'
                );
                return false;
            }

            // GTK3 destination: ~/.config/gtk-3.0/gtk.css
            const gtk3ConfigDir = GLib.build_filenamev([
                this.configDir,
                'gtk-3.0',
            ]);
            const gtk3DestPath = GLib.build_filenamev([
                gtk3ConfigDir,
                'gtk.css',
            ]);

            // GTK4 destination: ~/.config/gtk-4.0/gtk.css
            const gtk4ConfigDir = GLib.build_filenamev([
                this.configDir,
                'gtk-4.0',
            ]);
            const gtk4DestPath = GLib.build_filenamev([
                gtk4ConfigDir,
                'gtk.css',
            ]);

            // Ensure GTK config directories exist
            ensureDirectoryExists(gtk3ConfigDir);
            ensureDirectoryExists(gtk4ConfigDir);

            // Copy to GTK3
            const gtk3Success = this._copyGtkFile(
                gtkSourcePath,
                gtk3DestPath,
                'GTK3'
            );

            // Copy to GTK4
            const gtk4Success = this._copyGtkFile(
                gtkSourcePath,
                gtk4DestPath,
                'GTK4'
            );

            if (gtk3Success && gtk4Success) {
                console.log('GTK theme applied successfully to GTK3 and GTK4');
                return true;
            }

            return false;
        } catch (e) {
            console.error('Error applying GTK theme:', e.message);
            return false;
        }
    }

    /**
     * Copies GTK CSS file to destination with backup and permissions
     * @param {string} sourcePath - Source gtk.css path
     * @param {string} destPath - Destination gtk.css path
     * @param {string} label - Label for logging (e.g., "GTK3" or "GTK4")
     * @returns {boolean} True if successful, false otherwise
     * @private
     */
    _copyGtkFile(sourcePath, destPath, label) {
        try {
            // Create backup if file exists
            const destFile = Gio.File.new_for_path(destPath);
            if (destFile.query_exists(null)) {
                const backupPath = `${destPath}.backup`;
                const backupSuccess = copyFile(destPath, backupPath);
                if (backupSuccess) {
                    console.log(`Created ${label} backup: ${backupPath}`);
                }
            }

            // Copy the file
            const success = copyFile(sourcePath, destPath);

            if (success) {
                // Set file permissions to 0644 (rw-r--r--)
                this._setFilePermissions(destPath, 0o644);
                console.log(`${label} theme copied to: ${destPath}`);
                return true;
            } else {
                console.error(`Failed to copy ${label} theme to ${destPath}`);
                return false;
            }
        } catch (e) {
            console.error(`Error copying ${label} file:`, e.message);
            return false;
        }
    }

    /**
     * Sets file permissions using chmod
     * @param {string} filePath - Path to file
     * @param {number} mode - Octal permission mode (e.g., 0o644)
     * @private
     */
    _setFilePermissions(filePath, mode) {
        try {
            const file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) {
                return;
            }

            // Convert octal mode to string for chmod
            const modeStr = mode.toString(8);
            const command = `chmod ${modeStr} ${GLib.shell_quote(filePath)}`;
            const [success, , , result] = GLib.spawn_command_line_sync(command);

            if (result === 0) {
                console.log(
                    `Set permissions ${modeStr} on ${GLib.path_get_basename(filePath)}`
                );
            }
        } catch (e) {
            console.error('Error setting file permissions:', e.message);
        }
    }

    /**
     * Removes GTK theme by deleting gtk.css from GTK3/GTK4 directories
     * @returns {boolean} True if successful, false otherwise
     */
    clear() {
        try {
            let cleared = false;

            // GTK3 path
            const gtk3Path = GLib.build_filenamev([
                this.configDir,
                'gtk-3.0',
                'gtk.css',
            ]);

            // GTK4 path
            const gtk4Path = GLib.build_filenamev([
                this.configDir,
                'gtk-4.0',
                'gtk.css',
            ]);

            // Remove GTK3 theme
            const gtk3File = Gio.File.new_for_path(gtk3Path);
            if (gtk3File.query_exists(null)) {
                gtk3File.delete(null);
                console.log('Removed GTK3 theme');
                cleared = true;
            }

            // Remove GTK4 theme
            const gtk4File = Gio.File.new_for_path(gtk4Path);
            if (gtk4File.query_exists(null)) {
                gtk4File.delete(null);
                console.log('Removed GTK4 theme');
                cleared = true;
            }

            return cleared;
        } catch (e) {
            console.error('Error clearing GTK theme:', e.message);
            return false;
        }
    }
}
