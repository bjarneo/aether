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
 * Adjusts a color with various parameters
 * @param {string} hexColor - Hex color string
 * @param {number} vibrance - Saturation adjustment (-100 to 100)
 * @param {number} contrast - Contrast adjustment (-100 to 100)
 * @param {number} brightness - Brightness adjustment (-100 to 100)
 * @param {number} hueShift - Hue shift in degrees (-360 to 360)
 * @param {number} temperature - Temperature shift (-100 to 100, warm to cool)
 * @param {number} gamma - Gamma correction (0.1 to 3.0)
 * @returns {string} Adjusted hex color
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
 * Converts RGB values to hex
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color
 */
function rgbToHex(r, g, b) {
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
        const hue2rgb = (p, q, t) => {
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
 * Generates a complete 16-color ANSI palette from a single base color
 * Intelligently places the base color in the correct ANSI slot based on its hue,
 * then generates matching colors for other slots maintaining the same shade/lightness
 * @param {string} baseColor - Base hex color to derive palette from
 * @returns {string[]} Array of 16 hex colors for complete ANSI palette
 */
export function generatePaletteFromColor(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Extract base saturation and lightness - these will be preserved across all colors
    const baseSaturation = hsl.s;
    const baseLightness = hsl.l;
    const baseHue = hsl.h;

    // Determine which ANSI color slot (1-6) this base color belongs to based on hue
    // Red: 345-45°, Yellow: 45-75°, Green: 75-165°, Cyan: 165-195°, Blue: 195-285°, Magenta: 285-345°
    let baseSlot = 1; // Default to red
    if (baseHue >= 345 || baseHue < 45) {
        baseSlot = 1; // Red
    } else if (baseHue >= 45 && baseHue < 75) {
        baseSlot = 3; // Yellow
    } else if (baseHue >= 75 && baseHue < 165) {
        baseSlot = 2; // Green
    } else if (baseHue >= 165 && baseHue < 195) {
        baseSlot = 6; // Cyan
    } else if (baseHue >= 195 && baseHue < 285) {
        baseSlot = 4; // Blue
    } else if (baseHue >= 285 && baseHue < 345) {
        baseSlot = 5; // Magenta
    }

    // Define standard ANSI color hues (in degrees)
    const ansiHues = [
        0, // color1: Red
        120, // color2: Green
        60, // color3: Yellow
        240, // color4: Blue
        300, // color5: Magenta
        180, // color6: Cyan
    ];

    // Generate colors 1-6 using the base color's saturation and lightness
    const colors1to6 = ansiHues.map((hue, index) => {
        if (index + 1 === baseSlot) {
            // Use the exact base color for its slot
            return baseColor;
        }
        // Generate other colors with same saturation and lightness
        return hslToHex(hue, baseSaturation, baseLightness);
    });

    // Generate bright versions (8-14) - slightly brighter and more saturated
    const brightLightness = Math.min(100, baseLightness + 10);
    const brightSaturation = Math.min(100, baseSaturation * 1.1);
    const colors8to14 = ansiHues.map((hue, index) => {
        if (index + 1 === baseSlot) {
            // Bright version of base color
            return hslToHex(baseHue, brightSaturation, brightLightness);
        }
        return hslToHex(hue, brightSaturation, brightLightness);
    });

    // Generate background (color 0) - always very dark
    const backgroundColor = hslToHex(
        baseHue,
        baseSaturation * 0.4,
        Math.max(3, baseLightness * 0.15)
    );

    // Generate color 7 (white/light gray) - always light
    const color7 = hslToHex(baseHue, baseSaturation * 0.15, 92);

    // Generate color 8 (bright black) - darker gray between background and colors
    const color8 = hslToHex(
        baseHue,
        baseSaturation * 0.35,
        Math.min(40, baseLightness * 1.0)
    );

    // Generate color 15 (bright white) - always very bright
    const color15 = hslToHex(baseHue, baseSaturation * 0.1, 98);

    return [
        backgroundColor, // background
        colors1to6[0], // color1 (red)
        colors1to6[1], // color2 (green)
        colors1to6[2], // color3 (yellow)
        colors1to6[3], // color4 (blue)
        colors1to6[4], // color5 (magenta)
        colors1to6[5], // color6 (cyan)
        color7, // color7 (white)
        color8, // color8 (bright black)
        colors8to14[0], // color9 (bright red)
        colors8to14[1], // color10 (bright green)
        colors8to14[2], // color11 (bright yellow)
        colors8to14[3], // color12 (bright blue)
        colors8to14[4], // color13 (bright magenta)
        colors8to14[5], // color14 (bright cyan)
        color15, // color15 (bright white)
    ];
}
