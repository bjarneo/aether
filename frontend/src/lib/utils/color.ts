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

// RGB (0-255) → HSL with h,s,l all in 0..1 range.
// Shared primitive used by hexToHsl (scales to degrees/percent) and the
// palette-grade LUT builder in canvas-filters.ts.
export function rgbToHsl01(
    r: number,
    g: number,
    b: number
): {h: number; s: number; l: number} {
    const rn = r / 255,
        gn = g / 255,
        bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn) h = ((bn - rn) / d + 2) / 6;
        else h = ((rn - gn) / d + 4) / 6;
    }
    return {h, s, l};
}

export function hexToHsl(hex: string): {h: number; s: number; l: number} {
    if (!hex || hex.length < 7) return {h: 0, s: 0, l: 50};
    const {h, s, l} = rgbToHsl01(
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    );
    return {h: h * 360, s: s * 100, l: l * 100};
}

export function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

// HSL (all 0..1) → RGB (all 0..1).
export function hslToRgb01(
    h: number,
    s: number,
    l: number
): [number, number, number] {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hue2rgb(p, q, h + 1 / 3),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1 / 3),
    ];
}

export function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    const [r, g, b] = hslToRgb01(h / 360, s / 100, l / 100);
    const toHex = (n: number) => {
        const hex = Math.round(n * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function copyColor(hex: string): void {
    navigator.clipboard
        .writeText(hex)
        .then(() => showToast(`Copied ${hex}`))
        .catch(() => {});
}
