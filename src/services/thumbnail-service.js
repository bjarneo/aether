import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';

const THUMBNAIL_SIZE = 300;
const CACHE_DIR = GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    'aether',
    'wallpaper-thumbs',
]);

/**
 * ThumbnailService - Handles thumbnail generation and caching
 * Provides efficient async thumbnail loading with validation
 */
class ThumbnailService {
    constructor() {
        this._ensureCacheDir();
    }

    _ensureCacheDir() {
        const dir = Gio.File.new_for_path(CACHE_DIR);
        if (!dir.query_exists(null)) {
            try {
                dir.make_directory_with_parents(null);
            } catch (e) {
                console.error(
                    'Failed to create thumbnail cache directory:',
                    e.message
                );
            }
        }
    }

    getThumbnailPath(filePath) {
        const hash = GLib.compute_checksum_for_string(
            GLib.ChecksumType.MD5,
            filePath,
            -1
        );
        return GLib.build_filenamev([CACHE_DIR, `${hash}.png`]);
    }

    isThumbnailValid(thumbFile, originalFile) {
        if (!thumbFile.query_exists(null)) {
            return false;
        }

        try {
            const thumbInfo = thumbFile.query_info(
                'time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            const fileInfo = originalFile.query_info(
                'time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            const thumbTime = thumbInfo.get_modification_date_time().to_unix();
            const fileTime = fileInfo.get_modification_date_time().to_unix();

            return thumbTime >= fileTime;
        } catch (e) {
            return false;
        }
    }

    async generateThumbnail(filePath, thumbPath) {
        return new Promise(resolve => {
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                try {
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        filePath,
                        THUMBNAIL_SIZE,
                        THUMBNAIL_SIZE,
                        true
                    );
                    pixbuf.savev(thumbPath, 'png', [], []);
                    resolve(thumbPath);
                } catch (e) {
                    console.error(
                        `Failed to generate thumbnail for ${filePath}:`,
                        e.message
                    );
                    resolve(null);
                }
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    async getThumbnail(file) {
        const filePath = file.get_path();
        const thumbPath = this.getThumbnailPath(filePath);
        const thumbFile = Gio.File.new_for_path(thumbPath);

        if (this.isThumbnailValid(thumbFile, file)) {
            return thumbPath;
        }

        return await this.generateThumbnail(filePath, thumbPath);
    }

    clearCache() {
        try {
            const dir = Gio.File.new_for_path(CACHE_DIR);
            if (dir.query_exists(null)) {
                const enumerator = dir.enumerate_children(
                    'standard::name',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                while ((info = enumerator.next_file(null))) {
                    const child = dir.get_child(info.get_name());
                    child.delete(null);
                }
            }
        } catch (e) {
            console.error('Failed to clear thumbnail cache:', e.message);
        }
    }
}

export const thumbnailService = new ThumbnailService();
