import GLib from 'gi://GLib';

/**
 * Service Manager - Handles checking system services and restarting desktop components
 *
 * This module provides utilities for:
 * - Checking if omarchy theme system is installed
 * - Restarting swaybg wallpaper service
 */

/**
 * Checks if omarchy is installed by looking for the omarchy-theme-set command
 * @returns {boolean} True if omarchy is available
 */
export function isOmarchyInstalled() {
    try {
        const [success] = GLib.spawn_command_line_sync(
            'which omarchy-theme-set'
        );
        return success;
    } catch (e) {
        return false;
    }
}

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
