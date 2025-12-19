import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {loadJsonFile, saveJsonFile} from './file-utils.js';

/**
 * Migration utilities for Aether
 * Handles data migrations between versions
 */

/**
 * Migrates wallpapers from old cache location to new permanent location
 * Moves files from ~/.cache/aether/wallhaven-wallpapers/ to ~/.local/share/aether/wallpapers/
 * @returns {Object} Migration result with counts
 */
export function migrateWallpapersToDataDir() {
    const result = {
        moved: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };

    try {
        // Old cache directory
        const oldCacheDir = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            'aether',
            'wallhaven-wallpapers',
        ]);

        // New permanent data directory
        const newDataDir = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            'aether',
            'wallpapers',
        ]);

        const oldDir = Gio.File.new_for_path(oldCacheDir);

        // Check if old directory exists
        if (!oldDir.query_exists(null)) {
            console.log(
                '[Migration] No old wallpaper cache directory found, skipping migration'
            );
            return result;
        }

        // Create new directory if it doesn't exist
        const newDir = Gio.File.new_for_path(newDataDir);
        if (!newDir.query_exists(null)) {
            GLib.mkdir_with_parents(newDataDir, 0o755);
        }

        console.log(
            `[Migration] Starting wallpaper migration from ${oldCacheDir} to ${newDataDir}`
        );

        // Enumerate files in old directory
        const enumerator = oldDir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();
            const fileType = fileInfo.get_file_type();

            // Skip directories and non-image files
            if (fileType !== Gio.FileType.REGULAR) {
                continue;
            }

            // Check if it's an image file
            const extension = fileName.split('.').pop().toLowerCase();
            if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
                result.skipped++;
                continue;
            }

            try {
                const sourceFile = oldDir.get_child(fileName);
                const destFile = newDir.get_child(fileName);

                // Skip if destination already exists
                if (destFile.query_exists(null)) {
                    console.log(
                        `[Migration] Skipping ${fileName} (already exists in destination)`
                    );
                    result.skipped++;
                    continue;
                }

                // Move file
                sourceFile.move(destFile, Gio.FileCopyFlags.NONE, null, null);

                console.log(`[Migration] Moved ${fileName}`);
                result.moved++;
            } catch (fileError) {
                console.error(
                    `[Migration] Failed to move ${fileName}:`,
                    fileError.message
                );
                result.failed++;
                result.errors.push(`${fileName}: ${fileError.message}`);
            }
        }

        enumerator.close(null);

        // Try to remove old directory if empty
        try {
            const remainingFiles = [];
            const checkEnumerator = oldDir.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let remainingInfo;
            while ((remainingInfo = checkEnumerator.next_file(null)) !== null) {
                remainingFiles.push(remainingInfo.get_name());
            }
            checkEnumerator.close(null);

            if (remainingFiles.length === 0) {
                oldDir.delete(null);
                console.log('[Migration] Removed empty old cache directory');
            } else {
                console.log(
                    `[Migration] Old directory not removed (contains ${remainingFiles.length} items)`
                );
            }
        } catch (cleanupError) {
            console.warn(
                '[Migration] Failed to cleanup old directory:',
                cleanupError.message
            );
        }

        console.log(
            `[Migration] Complete: ${result.moved} moved, ${result.skipped} skipped, ${result.failed} failed`
        );
    } catch (error) {
        console.error('[Migration] Migration failed:', error.message);
        result.errors.push(`Migration error: ${error.message}`);
    }

    return result;
}

/**
 * Updates blueprint wallpaper paths from old cache location to new data location
 * Rewrites blueprint JSON files with updated paths
 * @returns {Object} Migration result with counts
 */
export function migrateBlueprintPaths() {
    const result = {
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };

    try {
        const blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints',
        ]);

        const dir = Gio.File.new_for_path(blueprintsDir);

        if (!dir.query_exists(null)) {
            console.log(
                '[Migration] No blueprints directory found, skipping blueprint path migration'
            );
            return result;
        }

        console.log(`[Migration] Updating blueprint paths in ${blueprintsDir}`);

        const oldCachePath = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            'aether',
            'wallhaven-wallpapers',
        ]);

        const newDataPath = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            'aether',
            'wallpapers',
        ]);

        // Enumerate blueprint files
        const enumerator = dir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();

            if (!fileName.endsWith('.json')) {
                continue;
            }

            try {
                const blueprintPath = GLib.build_filenamev([blueprintsDir, fileName]);
                const blueprint = loadJsonFile(blueprintPath, null);

                if (!blueprint) {
                    console.warn(
                        `[Migration] Failed to load blueprint: ${fileName}`
                    );
                    result.failed++;
                    continue;
                }

                // Check if blueprint has wallpaper path that needs updating
                if (
                    blueprint.palette &&
                    blueprint.palette.wallpaper &&
                    blueprint.palette.wallpaper.includes(oldCachePath)
                ) {
                    // Update the path
                    const oldPath = blueprint.palette.wallpaper;
                    const wallpaperFileName = GLib.path_get_basename(oldPath);
                    const newPath = GLib.build_filenamev([
                        newDataPath,
                        wallpaperFileName,
                    ]);

                    blueprint.palette.wallpaper = newPath;

                    // Write updated blueprint
                    saveJsonFile(blueprintPath, blueprint);

                    console.log(`[Migration] Updated blueprint: ${fileName}`);
                    result.updated++;
                } else {
                    result.skipped++;
                }
            } catch (fileError) {
                console.error(
                    `[Migration] Failed to process ${fileName}:`,
                    fileError.message
                );
                result.failed++;
                result.errors.push(`${fileName}: ${fileError.message}`);
            }
        }

        enumerator.close(null);

        console.log(
            `[Migration] Blueprint path migration complete: ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`
        );
    } catch (error) {
        console.error(
            '[Migration] Blueprint path migration failed:',
            error.message
        );
        result.errors.push(`Migration error: ${error.message}`);
    }

    return result;
}

/**
 * Runs all pending migrations
 * Checks migration version and runs necessary migrations
 */
export function runMigrations() {
    console.log('[Migration] Checking for pending migrations...');

    const configDir = GLib.build_filenamev([
        GLib.get_user_config_dir(),
        'aether',
    ]);
    const migrationFile = GLib.build_filenamev([
        configDir,
        'migration-version',
    ]);
    const file = Gio.File.new_for_path(migrationFile);

    let currentVersion = 0;

    // Read current migration version
    if (file.query_exists(null)) {
        try {
            const [success, contents] = file.load_contents(null);
            if (success) {
                const text = new TextDecoder('utf-8').decode(contents);
                currentVersion = parseInt(text.trim()) || 0;
            }
        } catch (error) {
            console.warn(
                '[Migration] Failed to read migration version:',
                error.message
            );
        }
    }

    console.log(`[Migration] Current migration version: ${currentVersion}`);

    // Migration 1: Move wallpapers from cache to data directory
    if (currentVersion < 1) {
        console.log(
            '[Migration] Running migration 1: Move wallpapers to data directory'
        );
        const result = migrateWallpapersToDataDir();

        if (result.moved > 0 || result.skipped > 0) {
            console.log(
                `[Migration] Migration 1 complete: ${result.moved} wallpapers moved`
            );
        }

        currentVersion = 1;
    }

    // Migration 2: Update blueprint paths
    if (currentVersion < 2) {
        console.log(
            '[Migration] Running migration 2: Update blueprint wallpaper paths'
        );
        const result = migrateBlueprintPaths();

        if (result.updated > 0) {
            console.log(
                `[Migration] Migration 2 complete: ${result.updated} blueprints updated`
            );
        }

        currentVersion = 2;
    }

    // Save migration version
    try {
        GLib.mkdir_with_parents(configDir, 0o755);
        file.replace_contents(
            new TextEncoder().encode(currentVersion.toString()),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
        console.log(
            `[Migration] Updated migration version to ${currentVersion}`
        );
    } catch (error) {
        console.error(
            '[Migration] Failed to save migration version:',
            error.message
        );
    }
}
