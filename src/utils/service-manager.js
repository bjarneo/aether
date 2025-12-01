import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {copyFile, ensureDirectoryExists} from './file-utils.js';

/**
 * Service Manager - Handles restarting various desktop services
 */

/**
 * Restarts swaybg wallpaper service with a new wallpaper
 * Uses uwsm-app to properly launch in the Hyprland/uwsm environment
 * @returns {boolean} Success status
 */
export function restartSwaybg() {
    try {
        // Use the symlink path that omarchy uses
        const backgroundLink = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.config',
            'omarchy',
            'current',
            'background',
        ]);

        console.log('Restarting swaybg with background link:', backgroundLink);

        // Kill existing swaybg process
        GLib.spawn_command_line_async('pkill -x swaybg');

        // Start swaybg using uwsm-app like omarchy does
        // setsid is used to detach from the current session
        GLib.spawn_command_line_async(
            `setsid uwsm-app -- swaybg -i "${backgroundLink}" -m fill`
        );

        console.log('Swaybg restarted successfully');
        return true;
    } catch (e) {
        console.error('Error restarting swaybg:', e.message);
        return false;
    }
}

/**
 * Copies Vencord theme to all existing Vencord/Vesktop theme directories
 * @param {string} sourcePath - Path to the vencord.theme.css file
 * @returns {number} Number of successful copies
 */
export function copyVencordTheme(sourcePath) {
    // Validate source path
    if (!sourcePath) {
        console.error('copyVencordTheme: sourcePath is required');
        return 0;
    }

    const sourceFile = Gio.File.new_for_path(sourcePath);
    if (!sourceFile.query_exists(null)) {
        console.error(`copyVencordTheme: Source file not found: ${sourcePath}`);
        return 0;
    }

    const homeDir = GLib.get_home_dir();
    const OUTPUT_FILENAME = 'aether.theme.css';

    // Define all possible Vencord/Vesktop theme directories
    const VENCORD_THEME_PATHS = [
        // Vesktop (Flatpak)
        ['.var', 'app', 'dev.vencord.Vesktop', 'config', 'vesktop', 'themes'],
        // Vesktop (Native/AUR/AppImage)
        ['.config', 'Vesktop', 'themes'],
        // Vencord (Native/AUR)
        ['.config', 'Vencord', 'themes'],
        // Vencord (Flatpak Discord)
        [
            '.var',
            'app',
            'com.discordapp.Discord',
            'config',
            'Vencord',
            'themes',
        ],
    ];

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
            const destPath = GLib.build_filenamev([themePath, OUTPUT_FILENAME]);
            const success = copyFile(sourcePath, destPath);

            if (success) {
                console.log(`Copied Vencord theme to: ${destPath}`);
                successCount++;
            } else {
                console.error(`Failed to copy Vencord theme to: ${destPath}`);
            }
        } catch (e) {
            console.error(
                `Error copying Vencord theme to ${pathComponents.join('/')}:`,
                e.message
            );
        }
    });

    if (successCount > 0) {
        console.log(
            `Successfully copied Vencord theme to ${successCount} location(s)`
        );
    } else {
        console.log(
            'No Vencord/Vesktop installations found. Theme not copied.'
        );
    }

    return successCount;
}

/**
 * Copies Zed theme to ~/.config/zed/themes/
 * @param {string} sourcePath - Path to the aether.zed.json file
 * @returns {boolean} Success status
 */
export function copyZedTheme(sourcePath) {
    // Validate source path
    if (!sourcePath) {
        console.error('copyZedTheme: sourcePath is required');
        return false;
    }

    const sourceFile = Gio.File.new_for_path(sourcePath);
    if (!sourceFile.query_exists(null)) {
        console.error(`copyZedTheme: Source file not found: ${sourcePath}`);
        return false;
    }

    const configDir = GLib.get_user_config_dir();
    const OUTPUT_FILENAME = 'aether.json';

    try {
        const zedThemesPath = GLib.build_filenamev([
            configDir,
            'zed',
            'themes',
        ]);

        // Ensure the themes directory exists
        ensureDirectoryExists(zedThemesPath);

        // Copy the theme file
        const destPath = GLib.build_filenamev([zedThemesPath, OUTPUT_FILENAME]);
        const success = copyFile(sourcePath, destPath);

        if (success) {
            console.log(`Copied Zed theme to: ${destPath}`);
            return true;
        } else {
            console.error(`Failed to copy Zed theme to: ${destPath}`);
            return false;
        }
    } catch (e) {
        console.error(`Error copying Zed theme:`, e.message);
        return false;
    }
}
