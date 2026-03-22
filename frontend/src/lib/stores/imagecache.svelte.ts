// Global image cache — persists across tab switches
// Thumbnails keyed as "thumb:{path}", full images as raw path

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);

function getExtension(path: string): string {
    const dot = path.lastIndexOf('.');
    return dot >= 0 ? path.slice(dot).toLowerCase() : '';
}

/** True when the file path points to a video. */
function isVideoPath(path: string): boolean {
    return VIDEO_EXTENSIONS.has(getExtension(path));
}

/** True when a src string (data URL or HTTP URL) represents video content. */
export function isVideoSource(src: string): boolean {
    if (src.startsWith('data:video/')) return true;
    // Localhost media server URLs contain the original path in the query string
    if (src.startsWith('http://127.0.0.1:')) {
        const match = src.match(/path=([^&]+)/);
        if (match) return isVideoPath(decodeURIComponent(match[1]));
    }
    return false;
}

let cache = $state<Record<string, string>>({});
let pending = $state<Record<string, boolean>>({});

// --- Thumbnail cache (for grids/cards) ---

export function getCachedThumbnail(path: string): string | undefined {
    return cache['thumb:' + path];
}

export function isThumbnailCached(path: string): boolean {
    return 'thumb:' + path in cache;
}

// --- Full image cache (for editor/hero) ---

export function getCachedFullImage(path: string): string | undefined {
    return cache[path];
}

// --- Generic ---

export function isPending(key: string): boolean {
    return pending[key] || false;
}

export function setCachedImage(key: string, dataUrl: string): void {
    cache = {...cache, [key]: dataUrl};
    const p = {...pending};
    delete p[key];
    pending = p;
}

// --- Loaders ---

// Load full-res media (for editor hero / preview)
// Videos are served via the local file handler (HTTP streaming with Range
// support) instead of base64 data URLs to avoid loading huge files into memory.
export async function loadFullImage(path: string): Promise<string> {
    if (cache[path]) return cache[path];
    if (pending[path]) return '';

    // Videos: get a real http://localhost URL from the Go media server.
    // webkit2gtk uses GStreamer for <video> playback which can't fetch from
    // the custom wails:// scheme — only http/https/file work.
    if (isVideoPath(path)) {
        try {
            const {GetMediaURL} = await import('../../../wailsjs/go/main/App');
            const url = await GetMediaURL(path);
            setCachedImage(path, url);
            return url;
        } catch {
            return '';
        }
    }

    pending = {...pending, [path]: true};
    try {
        const {ReadImageAsDataURL} = await import(
            '../../../wailsjs/go/main/App'
        );
        const dataUrl = await ReadImageAsDataURL(path);
        setCachedImage(path, dataUrl);
        return dataUrl;
    } catch {
        const p = {...pending};
        delete p[path];
        pending = p;
        return '';
    }
}

// Load thumbnail (for grids/cards)
export async function loadThumbnail(path: string): Promise<string> {
    const key = 'thumb:' + path;
    if (cache[key]) return cache[key];
    if (pending[key]) return '';

    pending = {...pending, [key]: true};
    try {
        const {GetThumbnail, ReadImageAsDataURL} = await import(
            '../../../wailsjs/go/main/App'
        );
        const thumbPath = await GetThumbnail(path);
        const dataUrl = await ReadImageAsDataURL(thumbPath);
        setCachedImage(key, dataUrl);
        return dataUrl;
    } catch {
        try {
            const {ReadImageAsDataURL} = await import(
                '../../../wailsjs/go/main/App'
            );
            const dataUrl = await ReadImageAsDataURL(path);
            setCachedImage(key, dataUrl);
            return dataUrl;
        } catch {
            const p = {...pending};
            delete p[key];
            pending = p;
            return '';
        }
    }
}
