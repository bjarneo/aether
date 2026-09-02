// Favorited wallpapers (local files and wallhaven), backed by the Go
// favorites service. Held in one place so the Local grid can show heart
// state without an IPC round-trip per card, and so toggling from any tab
// keeps the others in sync.

import type {favorites as favoritesNs} from '../../../wailsjs/go/models';

export type Favorite = favoritesNs.Favorite;

let favorites = $state<Favorite[]>([]);
let pathSet = $derived(new Set(favorites.map(f => f.path)));

refreshFavorites();

export async function refreshFavorites(): Promise<void> {
    try {
        const {GetFavorites} = await import('../../../wailsjs/go/main/App');
        const result = await GetFavorites();
        favorites = Array.isArray(result) ? result : [];
    } catch {
        favorites = [];
    }
}

export function getFavorites(): Favorite[] {
    return favorites;
}

export function isFavorite(path: string): boolean {
    return pathSet.has(path);
}

// Adds or removes `path`; resolves to the new favorited state. `data` is
// only used when adding (see favorites.Service.buildEntry for the shape
// each type accepts).
export async function toggleFavorite(
    path: string,
    type: string,
    data: Record<string, unknown> = {}
): Promise<boolean> {
    const {ToggleFavorite} = await import('../../../wailsjs/go/main/App');
    const nowFavorited = await ToggleFavorite(path, type, data);
    if (nowFavorited) {
        if (!pathSet.has(path)) favorites = [...favorites, {path, type, data}];
    } else {
        favorites = favorites.filter(f => f.path !== path);
    }
    return nowFavorited;
}
