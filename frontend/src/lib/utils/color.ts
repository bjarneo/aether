import {showToast} from '$lib/stores/ui.svelte';

/**
 * Determine if a hex color is perceptually light (for choosing text contrast).
 * Uses the ITU-R BT.601 luma formula.
 */
export function isLightColor(hex: string): boolean {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function hexToRgb(hex: string): {r: number; g: number; b: number} {
    if (!hex || hex.length < 7) return {r: 0, g: 0, b: 0};
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}

export function rgbToHex(r: number, g: number, b: number): string {
    return (
        '#' +
        [r, g, b]
            .map(v =>
                Math.max(0, Math.min(255, Math.round(v)))
                    .toString(16)
                    .padStart(2, '0')
            )
            .join('')
    );
}

export function hexToHsl(hex: string): {h: number; s: number; l: number} {
    if (!hex || hex.length < 7) return {h: 0, s: 0, l: 50};
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h = 0,
        s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return {h: h * 360, s: s * 100, l: l * 100};
}

export function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (n: number) => {
        const hex = Math.round(n * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r!)}${toHex(g!)}${toHex(b!)}`;
}

export function copyColor(hex: string): void {
    navigator.clipboard
        .writeText(hex)
        .then(() => showToast(`Copied ${hex}`))
        .catch(() => {});
}
