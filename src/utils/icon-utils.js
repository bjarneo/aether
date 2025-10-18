import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

/**
 * Utility functions for loading custom icons
 */

let iconsRegistered = false;

/**
 * Get the absolute path to the icons directory
 * @returns {string} Absolute path to icons directory
 */
export function getIconsDir() {
    // Get the directory where this script is located
    const scriptPath = import.meta.url.replace('file://', '');
    const scriptDir = GLib.path_get_dirname(scriptPath);
    const srcDir = GLib.path_get_dirname(scriptDir);
    
    return GLib.build_filenamev([srcDir, 'icons']);
}

/**
 * Register custom icons directory with GTK IconTheme
 * This allows custom icons to work like system icons with proper theming
 */
export function registerCustomIcons() {
    if (iconsRegistered) return;
    
    const display = Gdk.Display.get_default();
    const iconTheme = Gtk.IconTheme.get_for_display(display);
    const iconsDir = getIconsDir();
    
    iconTheme.add_search_path(iconsDir);
    console.log('Custom icons directory registered:', iconsDir);
    
    iconsRegistered = true;
}

/**
 * Get the absolute path to an icon file in src/icons/
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @returns {string} Absolute path to icon file
 */
export function getIconPath(iconName) {
    return GLib.build_filenamev([getIconsDir(), iconName]);
}

/**
 * Create a Gtk.Image from a custom SVG icon
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @param {number} size - Icon size in pixels (default: 16)
 * @returns {Gtk.Image} GTK Image widget with the custom icon
 */
export function createImageFromIcon(iconName, size = 16) {
    const iconPath = getIconPath(iconName);
    const file = Gio.File.new_for_path(iconPath);
    
    if (!file.query_exists(null)) {
        console.warn(`Icon file not found: ${iconPath}`);
        return new Gtk.Image({
            icon_name: 'image-missing',
            pixel_size: size,
        });
    }
    
    const image = new Gtk.Image({
        file: iconPath,
        pixel_size: size,
    });
    
    return image;
}

/**
 * Set a custom icon on a button
 * @param {Gtk.Button} button - Button to set icon on
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @param {number} size - Icon size in pixels (default: 16)
 */
export function setButtonIcon(button, iconName, size = 16) {
    const image = createImageFromIcon(iconName, size);
    button.set_child(image);
}
