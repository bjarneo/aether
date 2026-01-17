import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Reads file contents as text (synchronous)
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
 * Reads file contents as text (asynchronous)
 * @param {string} path - File path
 * @returns {Promise<string>} File contents
 */
export function readFileAsTextAsync(path) {
    return new Promise((resolve, reject) => {
        const file = Gio.File.new_for_path(path);
        file.load_contents_async(null, (source, result) => {
            try {
                const [success, contents] = source.load_contents_finish(result);
                if (!success) {
                    reject(new Error(`Could not read file: ${path}`));
                    return;
                }
                const decoder = new TextDecoder();
                resolve(decoder.decode(contents));
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Writes text content to file (synchronous)
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
 * Writes text content to file (asynchronous)
 * @param {string} path - File path
 * @param {string} content - Content to write
 * @returns {Promise<void>}
 */
export function writeTextToFileAsync(path, content) {
    return new Promise((resolve, reject) => {
        try {
            const file = Gio.File.new_for_path(path);

            // Ensure content is a string and not null/undefined
            if (content === null || content === undefined) {
                content = '';
            }

            const contentStr = String(content);
            const encoder = new TextEncoder();
            const bytes = encoder.encode(contentStr);

            file.replace_contents_async(
                bytes,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
                (source, result) => {
                    try {
                        const [success] =
                            source.replace_contents_finish(result);
                        if (!success) {
                            reject(new Error(`Failed to write file: ${path}`));
                            return;
                        }
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        } catch (e) {
            reject(e);
        }
    });
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
 * Enumerates files in a directory (synchronous)
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
 * Enumerates files in a directory (asynchronous)
 * @param {string} dirPath - Directory path
 * @param {string} attributes - File attributes to query
 * @returns {Promise<Array<{fileInfo: Gio.FileInfo, filePath: string, fileName: string}>>}
 */
export function enumerateDirectoryAsync(
    dirPath,
    attributes = 'standard::name,standard::type'
) {
    return new Promise((resolve, reject) => {
        try {
            const dir = Gio.File.new_for_path(dirPath);
            const results = [];

            dir.enumerate_children_async(
                attributes,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                null,
                (source, result) => {
                    try {
                        const enumerator =
                            source.enumerate_children_finish(result);

                        const processNextBatch = () => {
                            enumerator.next_files_async(
                                100, // Process in batches of 100
                                GLib.PRIORITY_DEFAULT,
                                null,
                                (enum_source, enum_result) => {
                                    try {
                                        const infos =
                                            enum_source.next_files_finish(
                                                enum_result
                                            );
                                        if (infos.length === 0) {
                                            enumerator.close_async(
                                                GLib.PRIORITY_DEFAULT,
                                                null,
                                                () => {}
                                            );
                                            resolve(results);
                                            return;
                                        }

                                        for (const fileInfo of infos) {
                                            const fileName =
                                                fileInfo.get_name();
                                            const filePath =
                                                GLib.build_filenamev([
                                                    dirPath,
                                                    fileName,
                                                ]);
                                            results.push({
                                                fileInfo,
                                                filePath,
                                                fileName,
                                            });
                                        }

                                        // Process next batch
                                        processNextBatch();
                                    } catch (e) {
                                        reject(e);
                                    }
                                }
                            );
                        };

                        processNextBatch();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        } catch (e) {
            reject(e);
        }
    });
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
 * Loads JSON from a file with optional default value
 * Uses try/catch as primary existence check to avoid redundant file operations
 * @param {string} path - File path
 * @param {*} [defaultValue=null] - Default value if file doesn't exist or can't be parsed
 * @returns {Object|*} Parsed JSON object or defaultValue
 */
export function loadJsonFile(path, defaultValue = null) {
    try {
        // Let readFileAsText throw if file doesn't exist - avoids redundant existence check
        const content = readFileAsText(path);
        return JSON.parse(content);
    } catch (e) {
        // File doesn't exist or couldn't be parsed - return default silently
        // Only log actual parsing errors, not missing files
        if (e.message && !e.message.includes('No such file')) {
            console.error(`Error loading JSON from ${path}:`, e.message);
        }
        return defaultValue;
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
 * Moves a file from source to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {boolean} Success status
 */
export function moveFile(sourcePath, destPath) {
    try {
        const sourceFile = Gio.File.new_for_path(sourcePath);
        const destFile = Gio.File.new_for_path(destPath);
        sourceFile.move(destFile, Gio.FileCopyFlags.NONE, null, null);
        return true;
    } catch (e) {
        console.error('Error moving file:', e.message);
        return false;
    }
}

/**
 * Gets subdirectories in a directory
 * @param {string} dirPath - Directory path
 * @returns {string[]} Array of subdirectory names (sorted)
 */
export function getSubdirectories(dirPath) {
    const subdirs = [];
    enumerateDirectory(dirPath, (fileInfo, filePath, fileName) => {
        if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
            subdirs.push(fileName);
        }
    });
    return subdirs.sort();
}

/**
 * Gets file modification time
 * @param {string} path - File path
 * @returns {number} Modification time as Unix timestamp, or 0 on error
 */
export function getFileModificationTime(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const info = file.query_info(
            'time::modified',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        return info.get_modification_date_time()?.to_unix() || 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Gets file size in bytes
 * @param {string} path - File path
 * @returns {number} File size in bytes, or 0 on error
 */
export function getFileSize(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const info = file.query_info(
            'standard::size',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        return info.get_size();
    } catch (e) {
        return 0;
    }
}

/**
 * Gets file metadata (size and modification time) in a single query
 * More efficient than calling getFileSize and getFileModificationTime separately
 * @param {string} path - File path
 * @returns {{size: number, modTime: number}} File metadata
 */
export function getFileMetadata(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const info = file.query_info(
            'standard::size,time::modified',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        return {
            size: info.get_size(),
            modTime: info.get_modification_date_time()?.to_unix() || 0,
        };
    } catch (e) {
        return {size: 0, modTime: 0};
    }
}

/**
 * Gets file metadata asynchronously (size and modification time) in a single query
 * @param {string} path - File path
 * @returns {Promise<{size: number, modTime: number}>} File metadata
 */
export function getFileMetadataAsync(path) {
    return new Promise(resolve => {
        const file = Gio.File.new_for_path(path);
        file.query_info_async(
            'standard::size,time::modified',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                try {
                    const info = source.query_info_finish(result);
                    resolve({
                        size: info.get_size(),
                        modTime:
                            info.get_modification_date_time()?.to_unix() || 0,
                    });
                } catch (e) {
                    resolve({size: 0, modTime: 0});
                }
            }
        );
    });
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
                console.error(
                    `Error removing existing ${label} symlink:`,
                    e.message
                );
            }
        }

        // Create symlink
        try {
            const symlinkGFile = Gio.File.new_for_path(symlinkPath);
            symlinkGFile.make_symbolic_link(sourcePath, null);
            console.log(
                `Created ${label} symlink: ${symlinkPath} -> ${sourcePath}`
            );
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
