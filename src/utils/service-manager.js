import GLib from 'gi://GLib';

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
