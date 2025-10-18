import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {readFileAsText} from '../utils/file-utils.js';
import {brightenColor, ensureHashPrefix} from '../utils/color-utils.js';

/**
 * Service for wallpaper color extraction using pywal
 */

/**
 * Extracts colors from a wallpaper image using pywal
 * @param {string} imagePath - Path to the wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode colors
 * @param {Function} onSuccess - Callback when colors are extracted (colors)
 * @param {Function} onError - Callback when extraction fails (error)
 */
export function extractColorsFromWallpaper(
    imagePath,
    lightMode,
    onSuccess,
    onError
) {
    try {
        const argv = ['wal', '-n', '-s', '-t', '-e'];
        if (lightMode) {
            argv.push('-l');
        }
        argv.push('-i', imagePath);
        
        console.log('Calling pywal with command:', argv.join(' '));
        
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.wait_async(null, (source, result) => {
            try {
                const success = source.wait_finish(result);
                const exitCode = source.get_exit_status();

                if (!success || exitCode !== 0) {
                    const stderr = source.get_stderr_pipe();
                    if (stderr) {
                        const stream = new Gio.DataInputStream({
                            base_stream: stderr,
                        });
                        const [line] = stream.read_line_utf8(null);
                        onError(new Error(`pywal error: ${line}`));
                        return;
                    }
                    onError(new Error('pywal failed with unknown error'));
                    return;
                }

                const colors = readWalColors();
                if (colors && colors.length === 16) {
                    onSuccess(colors);
                } else {
                    onError(new Error('Failed to read colors from wal cache'));
                }
            } catch (e) {
                onError(e);
            }
        });
    } catch (e) {
        onError(e);
    }
}

/**
 * Reads colors from the pywal cache
 * @returns {string[]|null} Array of 16 colors or null if error
 */
export function readWalColors() {
    try {
        const homeDir = GLib.get_home_dir();
        const colorsPath = GLib.build_filenamev([
            homeDir,
            '.cache',
            'wal',
            'colors',
        ]);

        const text = readFileAsText(colorsPath);

        // Parse colors (one per line), ensure they have # prefix
        let colors = text
            .trim()
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => ensureHashPrefix(line.trim()));

        // Make colors 9-15 brighter versions of colors 1-7 (skip color 8)
        if (colors.length >= 16) {
            colors = colors.map((color, index) => {
                if (index >= 9 && index <= 15) {
                    return brightenColor(colors[index - 8], 20);
                }
                return color;
            });
        }

        return colors;
    } catch (e) {
        console.error('Error reading wal colors:', e.message);
        return null;
    }
}
