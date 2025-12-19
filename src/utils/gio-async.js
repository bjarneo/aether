/**
 * gio-async.js - Promise wrappers for GLib/Gio async operations
 *
 * Provides modern async/await APIs for common GLib operations:
 * - Subprocess execution
 * - File reading/writing
 * - HTTP requests via Soup
 *
 * These wrappers eliminate callback hell and allow cleaner async code:
 *
 * BEFORE (callbacks):
 *   proc.communicate_utf8_async(null, null, (source, result) => {
 *       const [, stdout, stderr] = source.communicate_utf8_finish(result);
 *       // handle result...
 *   });
 *
 * AFTER (async/await):
 *   const { stdout, stderr, exitCode } = await runCommandAsync(['ls', '-la']);
 *
 * @module gio-async
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

// ============================================================================
// SUBPROCESS EXECUTION
// ============================================================================

/**
 * Result of a subprocess execution
 * @typedef {Object} CommandResult
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {number} exitCode - Exit code (0 = success)
 * @property {boolean} success - True if exit code is 0
 */

/**
 * Runs a command asynchronously and returns a Promise
 *
 * @param {string[]} argv - Command and arguments array
 * @param {Object} [options={}] - Options
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables
 * @param {boolean} [options.captureStderr=true] - Whether to capture stderr
 * @returns {Promise<CommandResult>} Command result
 *
 * @example
 * // Simple command
 * const { stdout, exitCode } = await runCommandAsync(['ls', '-la']);
 *
 * @example
 * // ImageMagick color extraction
 * const { stdout } = await runCommandAsync([
 *     'magick', imagePath,
 *     '-scale', '800x600>',
 *     '-colors', '32',
 *     '-format', '%c',
 *     'histogram:info:-'
 * ]);
 */
export function runCommandAsync(argv, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const {captureStderr = true} = options;

            let flags = Gio.SubprocessFlags.STDOUT_PIPE;
            if (captureStderr) {
                flags |= Gio.SubprocessFlags.STDERR_PIPE;
            }

            const proc = Gio.Subprocess.new(argv, flags);

            proc.communicate_utf8_async(null, null, (source, result) => {
                try {
                    const [, stdout, stderr] =
                        source.communicate_utf8_finish(result);
                    const exitCode = source.get_exit_status();

                    resolve({
                        stdout: stdout || '',
                        stderr: stderr || '',
                        exitCode,
                        success: exitCode === 0,
                    });
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Runs a command and only cares about success/failure
 *
 * @param {string[]} argv - Command and arguments
 * @returns {Promise<boolean>} True if command succeeded
 *
 * @example
 * const success = await runCommandSimple(['pkill', '-x', 'swaybg']);
 */
export async function runCommandSimple(argv) {
    try {
        const result = await runCommandAsync(argv, {captureStderr: false});
        return result.success;
    } catch (e) {
        return false;
    }
}

/**
 * Checks if a command exists in PATH
 *
 * @param {string} command - Command name
 * @returns {Promise<boolean>} True if command exists
 *
 * @example
 * if (await commandExists('magick')) {
 *     // ImageMagick is available
 * }
 */
export async function commandExists(command) {
    try {
        const result = await runCommandAsync(['which', command]);
        return result.success;
    } catch (e) {
        return false;
    }
}

/**
 * Spawns a detached background process (fire-and-forget)
 *
 * @param {string} commandLine - Full command line string
 * @returns {boolean} True if spawn succeeded
 *
 * @example
 * spawnDetached('setsid uwsm-app -- swaybg -i "/path/to/bg.jpg" -m fill');
 */
export function spawnDetached(commandLine) {
    try {
        GLib.spawn_command_line_async(commandLine);
        return true;
    } catch (e) {
        console.error(`Failed to spawn: ${commandLine}`, e.message);
        return false;
    }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Reads a file asynchronously
 *
 * @param {string} path - File path
 * @returns {Promise<string>} File contents as string
 *
 * @example
 * const content = await readFileAsync('/path/to/file.json');
 * const data = JSON.parse(content);
 */
export function readFileAsync(path) {
    return new Promise((resolve, reject) => {
        try {
            const file = Gio.File.new_for_path(path);

            file.load_contents_async(null, (source, result) => {
                try {
                    const [success, contents] =
                        source.load_contents_finish(result);

                    if (!success) {
                        reject(new Error(`Failed to read file: ${path}`));
                        return;
                    }

                    const decoder = new TextDecoder('utf-8');
                    resolve(decoder.decode(contents));
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Writes content to a file asynchronously
 *
 * @param {string} path - File path
 * @param {string} content - Content to write
 * @returns {Promise<boolean>} True if successful
 *
 * @example
 * await writeFileAsync('/path/to/file.json', JSON.stringify(data, null, 2));
 */
export function writeFileAsync(path, content) {
    return new Promise((resolve, reject) => {
        try {
            const file = Gio.File.new_for_path(path);
            const encoder = new TextEncoder();
            const bytes = encoder.encode(content);

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
                        resolve(success);
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
 * Checks if a file exists asynchronously
 *
 * @param {string} path - File path
 * @returns {Promise<boolean>} True if file exists
 */
export function fileExistsAsync(path) {
    return new Promise(resolve => {
        try {
            const file = Gio.File.new_for_path(path);

            file.query_info_async(
                'standard::type',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                null,
                (source, result) => {
                    try {
                        source.query_info_finish(result);
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                }
            );
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Copies a file asynchronously
 *
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @param {boolean} [overwrite=true] - Whether to overwrite existing file
 * @returns {Promise<boolean>} True if successful
 */
export function copyFileAsync(sourcePath, destPath, overwrite = true) {
    return new Promise((resolve, reject) => {
        try {
            const sourceFile = Gio.File.new_for_path(sourcePath);
            const destFile = Gio.File.new_for_path(destPath);

            const flags = overwrite
                ? Gio.FileCopyFlags.OVERWRITE
                : Gio.FileCopyFlags.NONE;

            sourceFile.copy_async(
                destFile,
                flags,
                GLib.PRIORITY_DEFAULT,
                null,
                null,
                (source, result) => {
                    try {
                        const success = source.copy_finish(result);
                        resolve(success);
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
 * Deletes a file asynchronously
 *
 * @param {string} path - File path
 * @returns {Promise<boolean>} True if successful
 */
export function deleteFileAsync(path) {
    return new Promise((resolve, reject) => {
        try {
            const file = Gio.File.new_for_path(path);

            file.delete_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
                try {
                    const success = source.delete_finish(result);
                    resolve(success);
                } catch (e) {
                    // File might not exist, that's ok
                    resolve(false);
                }
            });
        } catch (e) {
            resolve(false);
        }
    });
}

// ============================================================================
// DIRECTORY OPERATIONS
// ============================================================================

/**
 * Entry in a directory listing
 * @typedef {Object} DirectoryEntry
 * @property {string} name - File/directory name
 * @property {string} path - Full path
 * @property {boolean} isDirectory - True if this is a directory
 * @property {boolean} isSymlink - True if this is a symlink
 */

/**
 * Lists files in a directory asynchronously
 *
 * @param {string} dirPath - Directory path
 * @returns {Promise<DirectoryEntry[]>} Array of directory entries
 *
 * @example
 * const entries = await listDirectoryAsync('/home/user/Wallpapers');
 * const images = entries.filter(e => !e.isDirectory);
 */
export function listDirectoryAsync(dirPath) {
    return new Promise((resolve, reject) => {
        try {
            const dir = Gio.File.new_for_path(dirPath);

            dir.enumerate_children_async(
                'standard::name,standard::type,standard::is-symlink',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                null,
                (source, result) => {
                    try {
                        const enumerator =
                            source.enumerate_children_finish(result);
                        const entries = [];

                        const processNext = () => {
                            enumerator.next_files_async(
                                10, // batch size
                                GLib.PRIORITY_DEFAULT,
                                null,
                                (enumSource, enumResult) => {
                                    try {
                                        const infos =
                                            enumSource.next_files_finish(
                                                enumResult
                                            );

                                        if (infos.length === 0) {
                                            resolve(entries);
                                            return;
                                        }

                                        for (const info of infos) {
                                            const name = info.get_name();
                                            const type = info.get_file_type();

                                            entries.push({
                                                name,
                                                path: GLib.build_filenamev([
                                                    dirPath,
                                                    name,
                                                ]),
                                                isDirectory:
                                                    type ===
                                                    Gio.FileType.DIRECTORY,
                                                isSymlink:
                                                    info.get_is_symlink(),
                                            });
                                        }

                                        processNext();
                                    } catch (e) {
                                        reject(e);
                                    }
                                }
                            );
                        };

                        processNext();
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

// ============================================================================
// TIMING UTILITIES
// ============================================================================

/**
 * Promise-based delay
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 *
 * @example
 * await delay(100);
 * // Small delay to ensure file is written
 */
export function delay(ms) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

/**
 * Runs a function on the next idle tick
 *
 * @param {Function} fn - Function to run
 * @returns {Promise<*>} Result of the function
 */
export function runOnIdle(fn) {
    return new Promise((resolve, reject) => {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            try {
                const result = fn();
                resolve(result);
            } catch (e) {
                reject(e);
            }
            return GLib.SOURCE_REMOVE;
        });
    });
}

/**
 * Creates a debounced version of a function
 *
 * @param {Function} fn - Function to debounce
 * @param {number} waitMs - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSave = debounce(() => saveSettings(), 300);
 * // Only triggers after 300ms of inactivity
 */
export function debounce(fn, waitMs) {
    let timeoutId = null;

    return function (...args) {
        if (timeoutId !== null) {
            GLib.source_remove(timeoutId);
        }

        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, waitMs, () => {
            timeoutId = null;
            fn.apply(this, args);
            return GLib.SOURCE_REMOVE;
        });
    };
}

/**
 * Creates a throttled version of a function
 *
 * @param {Function} fn - Function to throttle
 * @param {number} limitMs - Minimum time between calls
 * @returns {Function} Throttled function
 *
 * @example
 * const throttledUpdate = throttle(() => updatePreview(), 100);
 * // At most once per 100ms
 */
export function throttle(fn, limitMs) {
    let lastRun = 0;
    let pendingTimeoutId = null;

    return function (...args) {
        const now = GLib.get_monotonic_time() / 1000;

        if (now - lastRun >= limitMs) {
            lastRun = now;
            fn.apply(this, args);
        } else if (!pendingTimeoutId) {
            const remaining = limitMs - (now - lastRun);
            pendingTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                remaining,
                () => {
                    pendingTimeoutId = null;
                    lastRun = GLib.get_monotonic_time() / 1000;
                    fn.apply(this, args);
                    return GLib.SOURCE_REMOVE;
                }
            );
        }
    };
}

// ============================================================================
// CANCELLATION
// ============================================================================

/**
 * Creates a cancellable token for async operations
 *
 * @returns {Object} Cancellation controller
 *
 * @example
 * const { token, cancel } = createCancellable();
 *
 * // Pass token to async operation
 * const result = await fetchWallpapers(query, token);
 *
 * // Cancel from elsewhere
 * cancel();
 */
export function createCancellable() {
    const cancellable = new Gio.Cancellable();

    return {
        /** The Gio.Cancellable instance */
        token: cancellable,
        /** Cancel the operation */
        cancel: () => cancellable.cancel(),
        /** Check if cancelled */
        isCancelled: () => cancellable.is_cancelled(),
    };
}
