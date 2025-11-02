import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {copyFile} from './file-utils.js';

/**
 * Opens a file picker dialog to select and upload a wallpaper to ~/Wallpapers
 * @param {Gtk.Widget} parent - Parent widget for the dialog
 * @param {Function} onSuccess - Callback function called with the wallpaper path on success
 * @param {Function} onError - Optional callback function called on error
 */
export function uploadWallpaper(parent, onSuccess, onError = null) {
    const dialog = new Gtk.FileDialog({title: 'Upload Wallpaper'});

    const filter = new Gtk.FileFilter();
    filter.add_mime_type('image/png');
    filter.add_mime_type('image/jpeg');
    filter.add_mime_type('image/webp');
    filter.set_name('Images');

    const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
    filterList.append(filter);
    dialog.set_filters(filterList);

    dialog.open(parent, null, (source, result) => {
        try {
            const file = dialog.open_finish(result);
            if (file) {
                const sourcePath = file.get_path();
                const fileName = GLib.path_get_basename(sourcePath);
                const wallpapersPath = GLib.build_filenamev([
                    GLib.get_home_dir(),
                    'Wallpapers',
                ]);
                const destPath = GLib.build_filenamev([
                    wallpapersPath,
                    fileName,
                ]);

                // Copy file to ~/Wallpapers
                const success = copyFile(sourcePath, destPath);
                if (success) {
                    console.log(`Wallpaper uploaded to: ${destPath}`);
                    if (onSuccess) {
                        onSuccess(destPath);
                    }
                } else {
                    console.error('Failed to copy wallpaper to ~/Wallpapers');
                    if (onError) {
                        onError(new Error('Failed to copy wallpaper'));
                    }
                }
            }
        } catch (e) {
            if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                console.error('Error selecting file:', e.message);
                if (onError) {
                    onError(e);
                }
            }
        }
    });
}

/**
 * Opens a file picker dialog to select multiple images to upload to ~/Wallpapers
 * @param {Gtk.Widget} parent - Parent widget for the dialog
 * @param {Function} onSuccess - Callback function called with array of wallpaper paths on success
 * @param {Function} onError - Optional callback function called on error
 */
export function uploadMultipleWallpapers(parent, onSuccess, onError = null) {
    const dialog = new Gtk.FileDialog({title: 'Select Images'});

    const filter = new Gtk.FileFilter();
    filter.add_mime_type('image/png');
    filter.add_mime_type('image/jpeg');
    filter.add_mime_type('image/webp');
    filter.set_name('Images');

    const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
    filterList.append(filter);
    dialog.set_filters(filterList);

    dialog.open_multiple(parent, null, (source, result) => {
        try {
            const files = dialog.open_multiple_finish(result);
            if (files) {
                const wallpapersPath = GLib.build_filenamev([
                    GLib.get_home_dir(),
                    'Wallpapers',
                ]);

                const uploadedPaths = [];
                const fileCount = files.get_n_items();

                for (let i = 0; i < fileCount; i++) {
                    const file = files.get_item(i);
                    const sourcePath = file.get_path();
                    const fileName = GLib.path_get_basename(sourcePath);
                    const destPath = GLib.build_filenamev([
                        wallpapersPath,
                        fileName,
                    ]);

                    // Copy file to ~/Wallpapers
                    const success = copyFile(sourcePath, destPath);
                    if (success) {
                        console.log(`Image uploaded to: ${destPath}`);
                        uploadedPaths.push(destPath);
                    } else {
                        console.error(`Failed to copy image: ${fileName}`);
                    }
                }

                if (uploadedPaths.length > 0 && onSuccess) {
                    onSuccess(uploadedPaths);
                } else if (uploadedPaths.length === 0 && onError) {
                    onError(new Error('Failed to copy any images'));
                }
            }
        } catch (e) {
            if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                console.error('Error selecting files:', e.message);
                if (onError) {
                    onError(e);
                }
            }
        }
    });
}
