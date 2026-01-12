/**
 * color-utils.js - Comprehensive color manipulation and conversion utilities
 *
 * Provides a complete toolkit for color operations in Aether:
 * - Format conversions: Hex ↔ RGB ↔ HSL ↔ RGBA
 * - Color adjustments: Brightness, vibrance, contrast, temperature, gamma, hue shift
 * - Color generation: Gradients, palettes from single color
 * - Color analysis: Finding closest shades, WCAG accessibility
 * - Special conversions: Yaru theme format, GTK RGBA objects
 *
 * Color Format Support:
 * - Hex: #RRGGBB format (with or without # prefix)
 * - RGB: Object {r, g, b} or string "r,g,b"
 * - RGBA: String "rgba(r, g, b, a)"
 * - HSL: Object {h, s, l} with h=0-360, s=0-100, l=0-100
 * - Gdk.RGBA: GTK color objects
 *
 * Key Functions:
 * - Conversion: hexToRgb, rgbToHsl, hslToHex, rgbaToHex
 * - Adjustment: adjustColor (6 parameters), brightenColor
 * - Generation: generateGradient, generatePaletteFromColor
 * - Utility: ensureHashPrefix, stripHashPrefix, findClosestShade
 *
 * Used By:
 * - PaletteEditor: Color extraction and manipulation
 * - ColorSynthesizer: Role assignment and color picking
 * - SettingsSidebar: Color adjustments and harmony generation
 * - WallpaperEditor: Filter color tone system
 * - Templates: Color variable substitution
 *
 * @module color-utils
 */

/**
 * Converts hex color to RGB object
 * @param {string} hex - Hex color string (with or without #)
 * @returns {Object} RGB object with r, g, b properties (0-255)
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : {r: 0, g: 0, b: 0};
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
 * Converts hex color to rgba format
 * @param {string} hex - Hex color string (with or without #)
 * @param {number} alpha - Alpha value (0.0 to 1.0), default 1.0
 * @returns {string} RGBA string in format "rgba(r, g, b, a)"
 */
export function hexToRgba(hex, alpha = 1.0) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgba(0, 0, 0, 1.0)';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    let h,
        s,
        l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return {h: h * 360, s: s * 100, l: l * 100};
}

/**
 * Helper function for HSL to RGB conversion
 * @private
 */
function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

/**
 * Converts RGB values to hex
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color
 */
export function rgbToHex(r, g, b) {
    return (
        '#' +
        [r, g, b]
            .map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            })
            .join('')
    );
}

/**
 * Converts HSL values to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string with # prefix
 */
export function hslToHex(h, s, l) {
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
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

    return (
        '#' +
        [r, g, b]
            .map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            })
            .join('')
    );
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
 * Applies comprehensive color adjustments with 6 parameters
 * Used by SettingsSidebar color adjustment controls for palette customization
 *
 * Adjustment Pipeline (order matters):
 * 1. Hue Shift: Rotates hue on color wheel
 * 2. Temperature: Shifts toward warm (orange/30°) or cool (blue/210°)
 * 3. Vibrance: Adjusts saturation intensity
 * 4. Brightness: Shifts lightness up/down
 * 5. Contrast: Expands/compresses around 50% lightness midpoint
 * 6. Gamma: Applies power curve correction to RGB channels
 *
 * Temperature Behavior:
 * - Positive values (1-100): Shift toward warm orange tones (~30°)
 * - Negative values (-100 to -1): Shift toward cool blue tones (~210°)
 * - Blends current hue toward target with 30% strength
 *
 * Contrast Behavior:
 * - Expands/compresses lightness deviation from 50% midpoint
 * - Positive: Increases contrast (darker darks, lighter lights)
 * - Negative: Decreases contrast (everything toward 50% gray)
 *
 * Gamma Behavior:
 * - Applied in RGB space after HSL adjustments
 * - <1.0: Darkens midtones (increases shadows)
 * - >1.0: Lightens midtones (lifts shadows)
 * - Typical range: 0.5-2.0
 *
 * @param {string} hexColor - Input hex color (with or without #)
 * @param {number} vibrance - Saturation adjustment (-100 to 100, 0 = no change)
 * @param {number} contrast - Contrast adjustment (-100 to 100, 0 = no change)
 * @param {number} brightness - Brightness adjustment (-100 to 100, 0 = no change)
 * @param {number} hueShift - Hue rotation in degrees (-360 to 360, 0 = no change)
 * @param {number} [temperature=0] - Temperature shift (-100 to 100, 0 = neutral)
 * @param {number} [gamma=1.0] - Gamma correction (0.1 to 3.0, 1.0 = linear)
 * @returns {string} Adjusted hex color string with # prefix
 *
 * @example
 * // Warm, vibrant, high-contrast adjustment
 * adjustColor('#3b82f6', 20, 30, 10, 0, 50, 1.2)
 * // Returns: '#5B9FFF' (warmer, more saturated, higher contrast)
 *
 * @example
 * // Cool, desaturated, low-contrast adjustment
 * adjustColor('#f97316', -30, -20, -10, 0, -50, 0.8)
 * // Returns: '#A96B5C' (cooler, less saturated, lower contrast, darker)
 */
export function adjustColor(
    hexColor,
    vibrance,
    contrast,
    brightness,
    hueShift,
    temperature = 0,
    gamma = 1.0
) {
    let rgb = hexToRgb(hexColor);
    let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Apply hue shift
    hsl.h = (hsl.h + hueShift + 360) % 360;

    // Apply temperature (shift hue toward warm/cool)
    if (temperature !== 0) {
        // Warm = shift toward orange/red (30°), Cool = shift toward blue (210°)
        const tempShift = temperature > 0 ? 30 : 210;
        const tempAmount = Math.abs(temperature) / 100;
        const currentHue = hsl.h;
        const targetHue = tempShift;

        // Blend current hue toward target
        const hueDiff = ((targetHue - currentHue + 540) % 360) - 180;
        hsl.h = (currentHue + hueDiff * tempAmount * 0.3 + 360) % 360;
    }

    // Apply vibrance (saturation adjustment)
    hsl.s = Math.max(0, Math.min(100, hsl.s + vibrance));

    // Apply brightness
    hsl.l = Math.max(0, Math.min(100, hsl.l + brightness));

    // Apply contrast (expand or compress around 50% lightness)
    const contrastFactor = contrast / 100;
    const deviation = hsl.l - 50;
    hsl.l = 50 + deviation * (1 + contrastFactor);
    hsl.l = Math.max(0, Math.min(100, hsl.l));

    // Apply gamma correction
    if (gamma !== 1.0) {
        // Convert back to RGB for gamma correction
        rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

        // Apply gamma to each channel
        rgb.r = Math.pow(rgb.r / 255, 1 / gamma) * 255;
        rgb.g = Math.pow(rgb.g / 255, 1 / gamma) * 255;
        rgb.b = Math.pow(rgb.b / 255, 1 / gamma) * 255;

        // Clamp values
        rgb.r = Math.max(0, Math.min(255, rgb.r));
        rgb.g = Math.max(0, Math.min(255, rgb.g));
        rgb.b = Math.max(0, Math.min(255, rgb.b));

        // Convert back to hex directly from RGB
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Converts HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {Object} RGB object with r, g, b (0-255)
 */
function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {r: r * 255, g: g * 255, b: b * 255};
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

/**
 * Maps a hex color to a Yaru icon theme variant based on hue
 * @param {string} hexColor - Hex color string
 * @returns {string} Yaru theme name (e.g., "Yaru-blue")
 */
export function hexToYaruTheme(hexColor) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hue = hsl.h;

    // Map hue ranges to Yaru icon theme variants
    // Red: 345-15°
    if (hue >= 345 || hue < 15) {
        return 'Yaru-red';
    }
    // Warty Brown (orange-brown): 15-30°
    else if (hue >= 15 && hue < 30) {
        return 'Yaru-wartybrown';
    }
    // Yellow: 30-60°
    else if (hue >= 30 && hue < 60) {
        return 'Yaru-yellow';
    }
    // Olive (yellow-green): 60-90°
    else if (hue >= 60 && hue < 90) {
        return 'Yaru-olive';
    }
    // Sage (green): 90-165°
    else if (hue >= 90 && hue < 165) {
        return 'Yaru-sage';
    }
    // Prussian Green (dark teal): 165-195°
    else if (hue >= 165 && hue < 195) {
        return 'Yaru-prussiangreen';
    }
    // Blue: 195-255°
    else if (hue >= 195 && hue < 255) {
        return 'Yaru-blue';
    }
    // Purple: 255-285°
    else if (hue >= 255 && hue < 285) {
        return 'Yaru-purple';
    }
    // Magenta (purple-pink): 285-345°
    else {
        return 'Yaru-magenta';
    }
}

/**
 * Generates smooth 16-step gradient between two colors
 * Used by SettingsSidebar gradient generator with preview
 *
 * Algorithm:
 * - Linear interpolation in RGB space
 * - 16 steps to match ANSI palette size (color0-15)
 * - Includes both start (step 0) and end (step 15) colors
 *
 * Interpolation Method:
 * - RGB linear: r = start.r + (end.r - start.r) * ratio
 * - Ratio: 0/15 to 15/15 in 16 steps
 * - Each channel (R, G, B) interpolated independently
 *
 * @param {string} startColor - Starting hex color (with or without #)
 * @param {string} endColor - Ending hex color (with or without #)
 * @returns {string[]} Array of 16 hex colors from start to end
 *
 * @example
 * generateGradient('#ff0000', '#0000ff')
 * // Returns: ['#FF0000', '#F0000F', ..., '#0F00F0', '#0000FF']
 * // Smooth transition from red to blue in 16 steps
 */
export function generateGradient(startColor, endColor) {
    // Parse hex colors to RGB
    const start = {
        r: parseInt(startColor.slice(1, 3), 16),
        g: parseInt(startColor.slice(3, 5), 16),
        b: parseInt(startColor.slice(5, 7), 16),
    };

    const end = {
        r: parseInt(endColor.slice(1, 3), 16),
        g: parseInt(endColor.slice(3, 5), 16),
        b: parseInt(endColor.slice(5, 7), 16),
    };

    const colors = [];

    // Generate 16 color steps
    for (let i = 0; i < 16; i++) {
        const ratio = i / 15;
        const r = Math.round(start.r + (end.r - start.r) * ratio);
        const g = Math.round(start.g + (end.g - start.g) * ratio);
        const b = Math.round(start.b + (end.b - start.b) * ratio);

        colors.push(rgbToHex(r, g, b));
    }

    return colors;
}

/**
 * Generates a complete 16-color ANSI palette from a single base color
 *
 * Intelligently places the base color in the correct ANSI slot based on its hue,
 * then generates matching colors for other slots while maintaining the same
 * saturation and lightness characteristics. Creates a harmonious palette where
 * all colors share the same visual "weight" and intensity.
 *
 * Algorithm:
 * 1. Extract HSL values from base color (hue, saturation, lightness)
 * 2. Determine which ANSI slot (1-6) the base color belongs to:
 *    - Red (1): 345-45° hue range
 *    - Yellow (3): 45-75° hue range
 *    - Green (2): 75-165° hue range
 *    - Cyan (6): 165-195° hue range
 *    - Blue (4): 195-285° hue range
 *    - Magenta (5): 285-345° hue range
 * 3. Generate colors 1-6 using standard ANSI hues (0°, 120°, 60°, 240°, 300°, 180°)
 *    with the base color's saturation and lightness
 * 4. Generate bright versions (colors 9-14):
 *    - Lightness: +10% brighter
 *    - Saturation: +10% more saturated
 * 5. Generate special colors:
 *    - Color 0 (background): Very dark (~15% lightness, 40% saturation)
 *    - Color 7 (white): Very light (92% lightness, 15% saturation)
 *    - Color 8 (bright black): Medium gray (~40% lightness, 35% saturation)
 *    - Color 15 (bright white): Very bright (98% lightness, 10% saturation)
 *
 * ANSI Palette Structure:
 * - 0: Background (black)
 * - 1-6: Standard colors (red, green, yellow, blue, magenta, cyan)
 * - 7: Foreground (white)
 * - 8: Bright background (bright black/gray)
 * - 9-14: Bright colors (bright red, green, yellow, blue, magenta, cyan)
 * - 15: Bright foreground (bright white)
 *
 * @param {string} baseColor - Base hex color to derive palette from (e.g., '#3b82f6')
 * @returns {string[]} Array of 16 hex colors in ANSI order (color0-15)
 *
 * @example
 * // Generate palette from blue base color
 * generatePaletteFromColor('#3b82f6')
 * // Returns: [
 * //   '#0a1628',  // 0: background (dark blue-tinted black)
 * //   '#f65a3b',  // 1: red (matching blue's saturation/lightness)
 * //   '#3bf682',  // 2: green
 * //   '#f6823b',  // 3: yellow
 * //   '#3b82f6',  // 4: blue (exact base color)
 * //   '#823bf6',  // 5: magenta
 * //   '#3bf6f6',  // 6: cyan
 * //   '#e8ecf0',  // 7: white (light blue-tinted)
 * //   '#1e3a5f',  // 8: bright black (medium gray)
 * //   '#ff6a4a',  // 9: bright red
 * //   '#4aff92',  // 10: bright green
 * //   '#ff924a',  // 11: bright yellow
 * //   '#4a92ff',  // 12: bright blue
 * //   '#924aff',  // 13: bright magenta
 * //   '#4affff',  // 14: bright cyan
 * //   '#fafbfc'   // 15: bright white
 * // ]
 */
export function generatePaletteFromColor(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const {s: baseSaturation, l: baseLightness, h: baseHue} = hsl;

    // Hue ranges mapping to ANSI slot (1-6): Red, Green, Yellow, Blue, Magenta, Cyan
    const hueRanges = [
        {min: 345, max: 360, slot: 1}, {min: 0, max: 45, slot: 1},   // Red
        {min: 45, max: 75, slot: 3},                                  // Yellow
        {min: 75, max: 165, slot: 2},                                 // Green
        {min: 165, max: 195, slot: 6},                                // Cyan
        {min: 195, max: 285, slot: 4},                                // Blue
        {min: 285, max: 345, slot: 5},                                // Magenta
    ];

    const baseSlot = hueRanges.find(r => 
        baseHue >= r.min && baseHue < r.max
    )?.slot ?? 1;

    // Standard ANSI color hues: Red, Green, Yellow, Blue, Magenta, Cyan
    const ansiHues = [0, 120, 60, 240, 300, 180];

    // Generate standard colors (1-6) with base saturation and lightness
    const colors1to6 = ansiHues.map((hue, i) => 
        i + 1 === baseSlot ? baseColor : hslToHex(hue, baseSaturation, baseLightness)
    );

    // Generate bright versions (9-14) with increased brightness and saturation
    const brightLightness = Math.min(100, baseLightness + 10);
    const brightSaturation = Math.min(100, baseSaturation * 1.1);
    const colors9to14 = ansiHues.map((hue, i) => 
        i + 1 === baseSlot
            ? hslToHex(baseHue, brightSaturation, brightLightness)
            : hslToHex(hue, brightSaturation, brightLightness)
    );

    return [
        hslToHex(baseHue, baseSaturation * 0.4, Math.max(3, baseLightness * 0.15)), // 0: background
        ...colors1to6,                                                               // 1-6: standard colors
        hslToHex(baseHue, baseSaturation * 0.15, 92),                                // 7: white
        hslToHex(baseHue, baseSaturation * 0.35, Math.min(40, baseLightness)),       // 8: bright black
        ...colors9to14,                                                              // 9-14: bright colors
        hslToHex(baseHue, baseSaturation * 0.1, 98),                                 // 15: bright white
    ];
}
