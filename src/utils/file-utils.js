import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Reads file contents as text
 * @param {string} path - File path
 * @returns {string} File contents
 * @throws {Error} If file cannot be read
 */
export function readFileAsText(path) {
    const file = Gio.File.new_for_path(path);
    const [success, contents] = file.load_contents(null);

    if (!success) {
        throw new Error(`Could not read file: ${path}`);
    }

    const decoder = new TextDecoder();
    return decoder.decode(contents);
}

/**
 * Writes text content to file
 * @param {string} path - File path
 * @param {string} content - Content to write
 * @throws {Error} If file cannot be written
 */
export function writeTextToFile(path, content) {
    try {
        const file = Gio.File.new_for_path(path);

        // Ensure content is a string and not null/undefined
        if (content === null || content === undefined) {
            content = '';
        }

        const contentStr = String(content);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(contentStr);

        // GJS file.replace_contents expects bytes
        const [success, etag] = file.replace_contents(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );

        if (!success) {
            throw new Error(`Failed to write file: ${path}`);
        }
    } catch (e) {
        console.error(`Error writing to ${path}:`, e.message);
        throw e;
    }
}

/**
 * Copies a file from source to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @param {boolean} overwrite - Whether to overwrite existing file
 * @returns {boolean} Success status
 */
export function copyFile(sourcePath, destPath, overwrite = true) {
    try {
        const sourceFile = Gio.File.new_for_path(sourcePath);
        const destFile = Gio.File.new_for_path(destPath);

        const flags = overwrite
            ? Gio.FileCopyFlags.OVERWRITE
            : Gio.FileCopyFlags.NONE;
        sourceFile.copy(destFile, flags, null, null);

        return true;
    } catch (e) {
        console.error('Error copying file:', e.message);
        return false;
    }
}

/**
 * Deletes a file
 * @param {string} path - File path
 * @returns {boolean} Success status
 */
export function deleteFile(path) {
    try {
        const file = Gio.File.new_for_path(path);
        file.delete(null);
        return true;
    } catch (e) {
        console.error('Error deleting file:', e.message);
        return false;
    }
}

/**
 * Ensures a directory exists, creating it and parent directories if needed
 * @param {string} path - Directory path
 * @param {number} permissions - Directory permissions (default: 0o755)
 */
export function ensureDirectoryExists(path, permissions = 0o755) {
    GLib.mkdir_with_parents(path, permissions);
}

/**
 * Enumerates files in a directory
 * @param {string} dirPath - Directory path
 * @param {Function} callback - Callback function called for each file (fileInfo, filePath)
 * @param {string} attributes - File attributes to query
 */
export function enumerateDirectory(
    dirPath,
    callback,
    attributes = 'standard::name,standard::type'
) {
    try {
        const dir = Gio.File.new_for_path(dirPath);
        const enumerator = dir.enumerate_children(
            attributes,
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();
            const filePath = GLib.build_filenamev([dirPath, fileName]);
            callback(fileInfo, filePath, fileName);
        }
    } catch (e) {
        console.error(`Error enumerating directory ${dirPath}:`, e.message);
    }
}

/**
 * Cleans all files in a directory
 * @param {string} dirPath - Directory path
 * @returns {boolean} Success status
 */
export function cleanDirectory(dirPath) {
    try {
        const dir = Gio.File.new_for_path(dirPath);

        if (!dir.query_exists(null)) {
            return true;
        }

        const enumerator = dir.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();
            const filePath = GLib.build_filenamev([dirPath, fileName]);
            deleteFile(filePath);
        }

        return true;
    } catch (e) {
        console.error('Error cleaning directory:', e.message);
        return false;
    }
}

/**
 * Checks if a file exists
 * @param {string} path - File path
 * @returns {boolean} Whether file exists
 */
export function fileExists(path) {
    const file = Gio.File.new_for_path(path);
    return file.query_exists(null);
}

/**
 * Loads JSON from a file
 * @param {string} path - File path
 * @returns {Object|null} Parsed JSON object or null if error
 */
export function loadJsonFile(path) {
    try {
        const content = readFileAsText(path);
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error loading JSON from ${path}:`, e.message);
        return null;
    }
}

/**
 * Saves JSON to a file
 * @param {string} path - File path
 * @param {Object} data - Data to save
 * @param {boolean} pretty - Whether to format JSON (default: true)
 * @returns {boolean} Success status
 */
export function saveJsonFile(path, data, pretty = true) {
    try {
        if (!data) {
            console.error('Cannot save null/undefined data to JSON file');
            return false;
        }
        const jsonStr = pretty
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data);
        if (!jsonStr) {
            console.error('JSON.stringify returned empty result');
            return false;
        }
        writeTextToFile(path, jsonStr);
        return true;
    } catch (e) {
        console.error(`Error saving JSON to ${path}:`, e.message);
        console.error(e.stack);
        return false;
    }
}

/**
 * Creates a symbolic link, with fallback to file copy if symlink fails
 * @param {string} sourcePath - Source file path (target of the symlink)
 * @param {string} symlinkPath - Path where symlink should be created
 * @param {string} label - Optional label for logging (default: 'symlink')
 * @returns {boolean} Success status
 */
export function createSymlink(sourcePath, symlinkPath, label = 'symlink') {
    try {
        // Ensure parent directory exists
        const parentDir = GLib.path_get_dirname(symlinkPath);
        ensureDirectoryExists(parentDir);

        // Remove existing symlink or file if it exists
        const symlinkFile = Gio.File.new_for_path(symlinkPath);
        if (symlinkFile.query_exists(null)) {
            try {
                symlinkFile.delete(null);
                console.log(`Removed existing ${label} symlink`);
            } catch (e) {
                console.error(`Error removing existing ${label} symlink:`, e.message);
            }
        }

        // Create symlink
        try {
            const symlinkGFile = Gio.File.new_for_path(symlinkPath);
            symlinkGFile.make_symbolic_link(sourcePath, null);
            console.log(`Created ${label} symlink: ${symlinkPath} -> ${sourcePath}`);
            return true;
        } catch (e) {
            console.error(`Error creating ${label} symlink:`, e.message);
            // Fallback: copy the file if symlink fails
            const copied = copyFile(sourcePath, symlinkPath);
            if (copied) {
                console.log(`Fallback: Copied file to ${symlinkPath}`);
            }
            return copied;
        }
    } catch (e) {
        console.error(`Error creating ${label} symlink:`, e.message);
        return false;
    }
}
