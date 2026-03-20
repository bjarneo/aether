// Global image cache — persists across tab switches
// Thumbnails keyed as "thumb:{path}", full images as raw path

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

// Load full-res image (for editor hero)
export async function loadFullImage(path: string): Promise<string> {
    if (cache[path]) return cache[path];
    if (pending[path]) return '';

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
