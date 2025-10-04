/**
 * Color utility functions for converting between different color formats
 * and performing color operations.
 */

/**
 * Converts hex color to RGB object
 * @param {string} hex - Hex color string (with or without #)
 * @returns {Object} RGB object with r, g, b properties (0-255)
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Converts hex color to decimal RGB string
 * @param {string} hex - Hex color string (with or without #)
 * @returns {string} RGB string in format "r,g,b"
 */
export function hexToRgbString(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0,0,0';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `${r},${g},${b}`;
}

/**
 * Converts RGB values to HSL
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {Object} HSL object with h (0-360), s (0-100), l (0-100)
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL values to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string with # prefix
 */
export function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGBA object to hex color
 * @param {Object} rgba - RGBA object with red, green, blue properties (0-1)
 * @returns {string} Hex color string with # prefix
 */
export function rgbaToHex(rgba) {
    const r = Math.round(rgba.red * 255);
    const g = Math.round(rgba.green * 255);
    const b = Math.round(rgba.blue * 255);

    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Brightens a hex color by increasing its lightness
 * @param {string} hexColor - Hex color string
 * @param {number} amount - Amount to brighten (default: 20)
 * @returns {string} Brightened hex color
 */
export function brightenColor(hexColor, amount = 20) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const newLightness = Math.min(100, hsl.l + amount);
    return hslToHex(hsl.h, hsl.s, newLightness);
}

/**
 * Adjusts a color with various parameters
 * @param {string} hexColor - Hex color string
 * @param {number} vibrance - Saturation adjustment (-100 to 100)
 * @param {number} contrast - Contrast adjustment (-100 to 100)
 * @param {number} brightness - Brightness adjustment (-100 to 100)
 * @param {number} hueShift - Hue shift in degrees (-360 to 360)
 * @returns {string} Adjusted hex color
 */
export function adjustColor(hexColor, vibrance, contrast, brightness, hueShift) {
    const rgb = hexToRgb(hexColor);
    let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Apply hue shift
    hsl.h = (hsl.h + hueShift + 360) % 360;

    // Apply vibrance (saturation adjustment)
    hsl.s = Math.max(0, Math.min(100, hsl.s + vibrance));

    // Apply brightness
    hsl.l = Math.max(0, Math.min(100, hsl.l + brightness));

    // Apply contrast (expand or compress around 50% lightness)
    const contrastFactor = contrast / 100;
    const deviation = hsl.l - 50;
    hsl.l = 50 + deviation * (1 + contrastFactor);
    hsl.l = Math.max(0, Math.min(100, hsl.l));

    return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Finds the closest shade from an array of shades
 * @param {string} currentColor - Current hex color
 * @param {string[]} shades - Array of hex colors
 * @returns {number} Index of closest shade
 */
export function findClosestShade(currentColor, shades) {
    const currentRgb = hexToRgb(currentColor);
    let closestIndex = 0;
    let minDistance = Infinity;

    shades.forEach((shade, index) => {
        const shadeRgb = hexToRgb(shade);

        // Calculate Euclidean distance in RGB space
        const distance = Math.sqrt(
            Math.pow(currentRgb.r - shadeRgb.r, 2) +
            Math.pow(currentRgb.g - shadeRgb.g, 2) +
            Math.pow(currentRgb.b - shadeRgb.b, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    return closestIndex;
}

/**
 * Ensures hex color has # prefix
 * @param {string} color - Color string
 * @returns {string} Color with # prefix
 */
export function ensureHashPrefix(color) {
    return color.startsWith('#') ? color : '#' + color;
}

/**
 * Removes # prefix from hex color
 * @param {string} color - Color string
 * @returns {string} Color without # prefix
 */
export function stripHashPrefix(color) {
    return color.replace('#', '');
}
