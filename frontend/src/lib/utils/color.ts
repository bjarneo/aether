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

export function isValidHex(hex: string): boolean {
    return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
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

function hue2rgb(p: number, q: number, t: number): number {
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

// sRGB 0..255 → linear 0..1 (inverse gamma companding).
function srgbToLinear(v: number): number {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// linear 0..1 → sRGB 0..255 (gamma companding + clamp).
function linearToSrgb(v: number): number {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// Björn Ottosson's OKLab matrix (linear sRGB → LMS → cube-root → OKLab).
function linearRgbToOklab(
    r: number,
    g: number,
    b: number
): [number, number, number] {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    return [
        0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    ];
}

function oklabToLinearRgb(
    L: number,
    a: number,
    b: number
): [number, number, number] {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    return [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}

// OKLCH: polar form of OKLab. l=0..1, c=0..~0.4 in sRGB gamut, h=0..360°.
export function hexToOklch(hex: string): {l: number; c: number; h: number} {
    if (!hex || hex.length < 7) return {l: 0, c: 0, h: 0};
    const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
    const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
    const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));
    const [L, A, B] = linearRgbToOklab(r, g, b);
    const c = Math.sqrt(A * A + B * B);
    let h = (Math.atan2(B, A) * 180) / Math.PI;
    if (h < 0) h += 360;
    // Neutral colors: hue is undefined; clamp to 0 so sliders don't jitter.
    if (c < 1e-6) h = 0;
    return {l: L, c, h};
}

export function oklchToHex(l: number, c: number, h: number): string {
    const rad = (h * Math.PI) / 180;
    const a = c * Math.cos(rad);
    const b = c * Math.sin(rad);
    const [lr, lg, lb] = oklabToLinearRgb(l, a, b);
    return (
        '#' +
        [lr, lg, lb]
            .map(v => linearToSrgb(v).toString(16).padStart(2, '0'))
            .join('')
    );
}

export function copyColor(hex: string): void {
    navigator.clipboard
        .writeText(hex)
        .then(() => showToast(`Copied ${hex}`))
        .catch(() => {});
}

// WCAG 2.1 relative luminance — gamma-decode sRGB channels, then weight by
// photopic luminous efficiency (Rec. 709). Returns 0..1.
export function relativeLuminance(hex: string): number {
    const {r, g, b} = hexToRgb(hex);
    const chan = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA-L' | 'fail';

/**
 * Categorize a WCAG contrast ratio. Thresholds per WCAG 2.1 SC 1.4.3 / 1.4.6:
 *   AAA       ≥ 7   (normal text)
 *   AA        ≥ 4.5 (normal text / AAA large)
 *   AA-large  ≥ 3   (large text only)
 *   fail      < 3
 */
export function contrastLevel(ratio: number): ContrastLevel {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA-L';
    return 'fail';
}

// WCAG 2.1 contrast ratio between two hex colors.
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}
