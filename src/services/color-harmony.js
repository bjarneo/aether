import {
    hexToRgb,
    rgbToHsl,
    hslToHex,
    brightenColor,
} from '../utils/color-utils.js';

/**
 * Service for generating color harmonies from a base color
 */

/**
 * Generates an analogous color harmony (colors adjacent on the color wheel)
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateAnalogousHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];

    const hueOffsets = [-30, -20, -10, 0, 10, 20, 30, 15];

    // Color 0: Dark background
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Normal ANSI colors with analogous hues
    for (let i = 1; i < 8; i++) {
        const hue = (hsl.h + hueOffsets[i - 1] + 360) % 360;
        const saturation = Math.max(50, hsl.s * 0.9);
        const lightness = i === 7 ? 75 : 55;
        colors[i] = hslToHex(hue, saturation, lightness);
    }

    // Color 8: Brighter background (for comments/secondary)
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions of 1-7
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates a monochromatic color harmony (same hue, different lightness)
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateMonochromaticHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];

    // Color 0: Dark background
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Progressive lightness, same hue
    const baseLightness = [50, 55, 60, 65, 70, 75, 80];
    for (let i = 1; i < 8; i++) {
        const saturation = hsl.s * 0.85;
        colors[i] = hslToHex(hsl.h, saturation, baseLightness[i - 1]);
    }

    // Color 8: Brighter background
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates a complementary color harmony (opposite colors on the wheel)
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateComplementaryHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];
    const complementHue = (hsl.h + 180) % 360;

    // Color 0: Dark background using base hue
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Alternate between base and complement
    const hues = [
        hsl.h,
        complementHue,
        hsl.h,
        complementHue,
        hsl.h,
        complementHue,
        hsl.h,
    ];
    for (let i = 1; i < 8; i++) {
        const saturation = Math.max(50, hsl.s * 0.85);
        const lightness = i === 7 ? 75 : 55;
        colors[i] = hslToHex(hues[i - 1], saturation, lightness);
    }

    // Color 8: Brighter background
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates a split-complementary color harmony
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateSplitComplementaryHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];
    const complement1 = (hsl.h + 150) % 360;
    const complement2 = (hsl.h + 210) % 360;

    // Color 0: Dark background
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Rotate through base and split complements
    const hues = [
        hsl.h,
        complement1,
        complement2,
        hsl.h,
        complement1,
        complement2,
        hsl.h,
    ];
    for (let i = 1; i < 8; i++) {
        const saturation = Math.max(50, hsl.s * 0.85);
        const lightness = i === 7 ? 75 : 55;
        colors[i] = hslToHex(hues[i - 1], saturation, lightness);
    }

    // Color 8: Brighter background
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates a square harmony (4 evenly spaced colors on the wheel)
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateSquareHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];
    const squareHues = [
        hsl.h,
        (hsl.h + 90) % 360,
        (hsl.h + 180) % 360,
        (hsl.h + 270) % 360,
    ];

    // Color 0: Dark background
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Rotate through 4 square hues
    for (let i = 1; i < 8; i++) {
        const hue = squareHues[(i - 1) % 4];
        const saturation = Math.max(50, hsl.s * 0.85);
        const lightness = i === 7 ? 75 : 55;
        colors[i] = hslToHex(hue, saturation, lightness);
    }

    // Color 8: Brighter background
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates shades from dark to light based on a color
 * @param {string} hexColor - Base hex color
 * @param {number} count - Number of shades to generate
 * @returns {string[]} Array of shade colors
 */
export function generateShades(hexColor, count) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const shades = [];

    for (let i = 0; i < count; i++) {
        const lightness = (i / (count - 1)) * 100;
        const shade = hslToHex(hsl.h, hsl.s, lightness);
        shades.push(shade);
    }

    return shades;
}

/**
 * Generates a triadic color harmony (3 evenly spaced colors)
 * @param {string} baseColor - Base hex color
 * @returns {string[]} Array of 16 colors
 */
export function generateTriadicHarmony(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];
    const triadHues = [hsl.h, (hsl.h + 120) % 360, (hsl.h + 240) % 360];

    // Color 0: Dark background
    colors[0] = hslToHex(hsl.h, Math.min(hsl.s * 0.3, 15), 8);

    // Colors 1-7: Rotate through 3 triadic hues
    for (let i = 1; i < 8; i++) {
        const hue = triadHues[(i - 1) % 3];
        const saturation = Math.max(50, hsl.s * 0.85);
        const lightness = i === 7 ? 75 : 55;
        colors[i] = hslToHex(hue, saturation, lightness);
    }

    // Color 8: Brighter background
    colors[8] = hslToHex(hsl.h, Math.min(hsl.s * 0.4, 20), 25);

    // Colors 9-15: Bright versions
    for (let i = 9; i < 16; i++) {
        colors[i] = brightenColor(colors[i - 8], 20);
    }

    return colors;
}

/**
 * Generates a color harmony based on type
 * @param {string} baseColor - Base hex color
 * @param {number} harmonyType - Type index (0-5)
 * @returns {string[]} Array of 16 colors
 */
export function generateHarmony(baseColor, harmonyType) {
    switch (harmonyType) {
        case 0:
            return generateComplementaryHarmony(baseColor); // Complementary
        case 1:
            return generateAnalogousHarmony(baseColor); // Analogous
        case 2:
            return generateTriadicHarmony(baseColor); // Triadic
        case 3:
            return generateSplitComplementaryHarmony(baseColor); // Split Complementary
        case 4:
            return generateSquareHarmony(baseColor); // Tetradic (Square)
        case 5:
            return generateMonochromaticHarmony(baseColor); // Monochromatic
        default:
            return generateComplementaryHarmony(baseColor);
    }
}
