import {hexToRgb, rgbToHsl, hslToHex} from '../color-utils.js';
import {
    MONOCHROME_SATURATION_THRESHOLD,
    MONOCHROME_IMAGE_THRESHOLD,
    MIN_CHROMATIC_SATURATION,
    TOO_DARK_THRESHOLD,
    TOO_BRIGHT_THRESHOLD,
    DARK_COLOR_THRESHOLD,
    ANSI_HUE_ARRAY,
    BRIGHT_COLOR_LIGHTNESS_BOOST,
    BRIGHT_COLOR_SATURATION_BOOST,
} from './constants.js';

/**
 * Color analysis utilities for palette generation
 * Provides color classification, matching, and manipulation functions
 *
 * @module color-extraction/color-analysis
 */

/**
 * Determines if a color is considered "dark" based on lightness
 * @param {string} hexColor - Hex color string
 * @returns {boolean} True if dark, false if light
 */
export function isDarkColor(hexColor) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hsl.l < DARK_COLOR_THRESHOLD;
}

/**
 * Extracts HSL values from a hex color
 * @param {string} hexColor - Hex color string
 * @returns {{h: number, s: number, l: number}} HSL object
 */
export function getColorHSL(hexColor) {
    const rgb = hexToRgb(hexColor);
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculates circular hue distance between two hues
 * Handles wraparound at 360 degrees
 *
 * @param {number} hue1 - First hue (0-360)
 * @param {number} hue2 - Second hue (0-360)
 * @returns {number} Minimum distance between hues (0-180)
 */
export function calculateHueDistance(hue1, hue2) {
    let diff = Math.abs(hue1 - hue2);
    if (diff > 180) diff = 360 - diff;
    return diff;
}

/**
 * Detects if the extracted colors are mostly monochrome/grayscale
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if mostly monochrome
 */
export function isMonochromeImage(colors) {
    let lowSaturationCount = 0;

    for (const color of colors) {
        const hsl = getColorHSL(color);
        if (hsl.s < MONOCHROME_SATURATION_THRESHOLD) {
            lowSaturationCount++;
        }
    }

    return lowSaturationCount / colors.length > MONOCHROME_IMAGE_THRESHOLD;
}

/**
 * Detects if colors are too similar to each other (low color diversity)
 * Uses optimized hue bucketing instead of O(n²) pairwise comparison
 *
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if colors lack diversity
 */
export function hasLowColorDiversity(colors) {
    // Sample first 16 colors for faster analysis
    const sampleSize = Math.min(16, colors.length);
    const sampledColors = colors.slice(0, sampleSize);

    // Convert to HSL and filter out grayscale
    const chromaticColors = [];
    for (const color of sampledColors) {
        const hsl = getColorHSL(color);
        if (hsl.s >= MONOCHROME_SATURATION_THRESHOLD) {
            chromaticColors.push({hue: hsl.h, lightness: hsl.l});
        }
    }

    // If less than 3 chromatic colors, can't determine diversity meaningfully
    if (chromaticColors.length < 3) return false;

    // Use hue bucketing for O(n) complexity
    // Divide the hue wheel into 12 buckets (30 degrees each)
    const hueBuckets = new Array(12).fill(0);
    const HUE_BUCKET_SIZE = 30;

    for (const color of chromaticColors) {
        const bucket = Math.floor(color.hue / HUE_BUCKET_SIZE) % 12;
        hueBuckets[bucket]++;
    }

    // Count how many buckets have colors
    const occupiedBuckets = hueBuckets.filter(count => count > 0).length;

    // If colors are spread across fewer than 3 hue buckets, they lack diversity
    return occupiedBuckets < 3;
}

/**
 * Finds a color by lightness extremity
 * @param {string[]} colors - Array of hex colors
 * @param {boolean} findLightest - Whether to find lightest (true) or darkest (false)
 * @param {Set<number>} [excludeIndices] - Indices to skip
 * @returns {{color: string, index: number}} Found color and its index
 * @private
 */
function findColorByLightness(colors, findLightest, excludeIndices = null) {
    let bestIndex = 0;
    let bestLightness = findLightest ? -1 : 101;

    for (let i = 0; i < colors.length; i++) {
        if (excludeIndices?.has(i)) continue;

        const hsl = getColorHSL(colors[i]);
        const isBetter = findLightest
            ? hsl.l > bestLightness
            : hsl.l < bestLightness;

        if (isBetter) {
            bestLightness = hsl.l;
            bestIndex = i;
        }
    }

    return {color: colors[bestIndex], index: bestIndex};
}

/**
 * Finds background color - darkest or lightest based on mode
 * @param {string[]} colors - Array of hex colors
 * @param {boolean} lightMode - Light mode flag
 * @returns {{color: string, index: number}} Background color and its index
 */
export function findBackgroundColor(colors, lightMode) {
    return findColorByLightness(colors, lightMode);
}

/**
 * Finds foreground color - opposite of background
 * @param {string[]} colors - Array of hex colors
 * @param {boolean} lightMode - Light mode flag
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {{color: string, index: number}} Foreground color and its index
 */
export function findForegroundColor(colors, lightMode, usedIndices) {
    return findColorByLightness(colors, !lightMode, usedIndices);
}

/**
 * Calculates color quality score for ANSI color selection
 * Prioritizes hue accuracy, then favors more saturated colors
 *
 * @param {{h: number, s: number, l: number}} hsl - HSL color values
 * @param {number} targetHue - Target hue (0-360)
 * @returns {number} Score (lower is better)
 */
export function calculateColorScore(hsl, targetHue) {
    const hueDiff = calculateHueDistance(hsl.h, targetHue) * 3;
    const saturationPenalty = hsl.s < MIN_CHROMATIC_SATURATION ? 50 : 0;
    const saturationReward = (100 - hsl.s) / 2;
    const lightnessPenalty =
        hsl.l < TOO_DARK_THRESHOLD || hsl.l > TOO_BRIGHT_THRESHOLD ? 10 : 0;

    return hueDiff + saturationPenalty + saturationReward + lightnessPenalty;
}

/**
 * Finds the best matching color for a specific ANSI color role
 * @param {number} targetHue - Target hue (0-360)
 * @param {string[]} colorPool - Available colors to choose from
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {number} Index of best match in colorPool
 */
export function findBestColorMatch(targetHue, colorPool, usedIndices) {
    let bestIndex = -1;
    let bestScore = Infinity;

    for (let i = 0; i < colorPool.length; i++) {
        if (usedIndices.has(i)) continue;

        const hsl = getColorHSL(colorPool[i]);
        const score = calculateColorScore(hsl, targetHue);

        if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }

    return bestIndex !== -1 ? bestIndex : 0;
}

/**
 * Generates a lighter version of a color for bright ANSI slots
 * @param {string} hexColor - Base hex color
 * @returns {string} Lightened hex color
 */
export function generateBrightVersion(hexColor) {
    const hsl = getColorHSL(hexColor);
    const newLightness = Math.min(100, hsl.l + BRIGHT_COLOR_LIGHTNESS_BOOST);
    const newSaturation = Math.min(100, hsl.s * BRIGHT_COLOR_SATURATION_BOOST);
    return hslToHex(hsl.h, newSaturation, newLightness);
}

/**
 * Adjusts a single color for background contrast
 * @param {string} hexColor - Hex color to adjust
 * @param {number} targetLightness - Target lightness value
 * @returns {string} Adjusted hex color
 */
export function adjustColorLightness(hexColor, targetLightness) {
    const hsl = getColorHSL(hexColor);
    return hslToHex(hsl.h, hsl.s, targetLightness);
}

/**
 * Sorts colors by lightness
 * @param {string[]} colors - Array of hex colors
 * @returns {Array<{color: string, lightness: number, hue: number}>} Sorted color data
 */
export function sortColorsByLightness(colors) {
    return colors
        .map(color => {
            const hsl = getColorHSL(color);
            return {color, lightness: hsl.l, hue: hsl.h};
        })
        .sort((a, b) => a.lightness - b.lightness);
}
