import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {
    readFileAsText,
    writeTextToFile,
    fileExists,
    ensureDirectoryExists,
} from '../file-utils.js';
import {ANSI_PALETTE_SIZE, CACHE_VERSION} from './constants.js';
import {createLogger} from '../logger.js';

const log = createLogger('ColorCache');

/**
 * Color extraction cache management
 * Caches extracted palettes to avoid re-processing unchanged images
 *
 * @module color-extraction/cache
 */

/**
 * Gets the cache directory for color extraction
 * @returns {string} Cache directory path
 */
export function getCacheDir() {
    const homeDir = GLib.get_home_dir();
    return GLib.build_filenamev([homeDir, '.cache', 'aether', 'color-cache']);
}

/**
 * Generates a cache key based on image path and modification time
 * @param {string} imagePath - Path to the image
 * @param {boolean} lightMode - Light mode flag
 * @returns {string|null} Cache key or null if error
 */
export function getCacheKey(imagePath, lightMode) {
    try {
        const file = Gio.File.new_for_path(imagePath);
        const info = file.query_info(
            'time::modified',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        const mtime = info.get_modification_date_time();
        const mtimeSeconds = mtime.to_unix();

        const dataString = `${imagePath}-${mtimeSeconds}-${lightMode ? 'light' : 'dark'}`;
        const checksum = GLib.compute_checksum_for_string(
            GLib.ChecksumType.MD5,
            dataString,
            -1
        );

        return checksum;
    } catch (e) {
        log.error('Error generating cache key', e);
        return null;
    }
}

/**
 * Loads cached color palette if available
 * @param {string} cacheKey - Cache key
 * @returns {string[]|null} Cached palette or null
 */
export function loadCachedPalette(cacheKey) {
    try {
        const cacheDir = getCacheDir();
        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);

        if (!fileExists(cachePath)) {
            return null;
        }

        const content = readFileAsText(cachePath);
        const data = JSON.parse(content);

        if (
            Array.isArray(data.palette) &&
            data.palette.length === ANSI_PALETTE_SIZE
        ) {
            log.debug('Using cached color extraction result');
            return data.palette;
        }

        return null;
    } catch (e) {
        log.error('Error loading cache', e);
        return null;
    }
}

/**
 * Saves color palette to cache
 * @param {string} cacheKey - Cache key
 * @param {string[]} palette - Color palette to cache
 */
export function savePaletteToCache(cacheKey, palette) {
    try {
        const cacheDir = getCacheDir();
        ensureDirectoryExists(cacheDir);

        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);
        const data = {
            palette: palette,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };

        writeTextToFile(cachePath, JSON.stringify(data, null, 2));
        log.debug('Saved color extraction to cache');
    } catch (e) {
        log.error('Error saving to cache', e);
    }
}

/**
 * Clears the entire color extraction cache
 */
export function clearCache() {
    try {
        const cacheDir = getCacheDir();
        const dir = Gio.File.new_for_path(cacheDir);

        if (!dir.query_exists(null)) {
            return;
        }

        const enumerator = dir.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            if (name.endsWith('.json')) {
                const file = dir.get_child(name);
                file.delete(null);
            }
        }

        log.info('Color cache cleared');
    } catch (e) {
        log.error('Error clearing cache', e);
    }
}
