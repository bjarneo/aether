import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {copyFile, ensureDirectoryExists} from './file-utils.js';

/**
 * Service Manager - Handles restarting various desktop services
 */

/**
 * Restarts swaybg wallpaper service with a new wallpaper
 * @param {string} wallpaperPath - Path to the wallpaper image
 * @returns {boolean} Success status
 */
export function restartSwaybg(wallpaperPath) {
    try {
        console.log('Restarting swaybg with wallpaper:', wallpaperPath);

        // Kill existing swaybg process
        GLib.spawn_command_line_async('pkill -x swaybg');

        // Start swaybg with new wallpaper
        GLib.spawn_command_line_async(`swaybg -i "${wallpaperPath}" -m fill`);

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
