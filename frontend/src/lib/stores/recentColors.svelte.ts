import {isValidHex} from '$lib/utils/color';
import {STORAGE_KEYS} from '$lib/constants/storage';

const MAX_RECENT = 12;

function load(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.recentColors);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidHex).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

function persist(colors: string[]) {
    try {
        localStorage.setItem(STORAGE_KEYS.recentColors, JSON.stringify(colors));
    } catch {
        // quota / storage disabled
    }
}

let recent = $state<string[]>(load());

export function getRecentColors(): string[] {
    return recent;
}

export function pushRecentColor(hex: string): void {
    if (!isValidHex(hex)) return;
    const norm = hex.toLowerCase();
    if (recent[0]?.toLowerCase() === norm) return;
    const next = [hex, ...recent.filter(c => c.toLowerCase() !== norm)].slice(
        0,
        MAX_RECENT
    );
    recent = next;
    persist(next);
}
