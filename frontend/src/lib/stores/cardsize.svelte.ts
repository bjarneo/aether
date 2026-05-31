// Shared card-size preference for the wallpaper/theme grids (Wallhaven,
// Local, Blueprints, System Themes). One remembered choice so every grid
// renders cards at the same scale. Persisted to localStorage.
import {STORAGE_KEYS} from '$lib/constants/storage';

export type CardSize = 'small' | 'medium' | 'large';

// Min column width (px) per size. Grids use
// `repeat(auto-fill, minmax(N, 1fr))`, so this is the floor before another
// column is added. Matches Wallhaven's original scale.
export const CARD_MIN_WIDTH: Record<CardSize, number> = {
    small: 220,
    medium: 340,
    large: 500,
};

const VALID: readonly CardSize[] = ['small', 'medium', 'large'];

function load(): CardSize {
    try {
        const v = localStorage.getItem(STORAGE_KEYS.cardSize);
        if (v && (VALID as readonly string[]).includes(v)) {
            return v as CardSize;
        }
    } catch {}
    return 'small';
}

let cardSize = $state<CardSize>(load());

export function getCardSize(): CardSize {
    return cardSize;
}

export function setCardSize(size: CardSize): void {
    cardSize = size;
    try {
        localStorage.setItem(STORAGE_KEYS.cardSize, size);
    } catch {}
}
