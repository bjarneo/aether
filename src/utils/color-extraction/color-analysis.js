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
    SYNTHESIS_SCORE_THRESHOLD,
    ANSI_MIN_SATURATION_FOR_MATCH,
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
 * Balances hue accuracy, saturation preference, and lightness suitability
 * Lower score = better match
 *
 * @param {{h: number, s: number, l: number}} hsl - HSL color values
 * @param {number} targetHue - Target hue (0-360)
 * @returns {number} Score (lower is better)
 */
export function calculateColorScore(hsl, targetHue) {
    // Hue accuracy - primary factor
    const hueScore = calculateHueDistance(hsl.h, targetHue) * 2.5;

    // Saturation preference - strongly prefer chromatic colors
    let satScore;
    if (hsl.s < ANSI_MIN_SATURATION_FOR_MATCH) satScore = 80;
    else if (hsl.s < 20) satScore = 40;
    else if (hsl.s < 30) satScore = 15;
    else satScore = Math.max(0, (50 - hsl.s) * 0.3);

    // Lightness suitability - prefer mid-range, penalize extremes
    let lightnessScore;
    if (hsl.l < TOO_DARK_THRESHOLD)
        lightnessScore = (TOO_DARK_THRESHOLD - hsl.l) * 2.5;
    else if (hsl.l > TOO_BRIGHT_THRESHOLD)
        lightnessScore = (hsl.l - TOO_BRIGHT_THRESHOLD) * 2;
    else lightnessScore = Math.abs(hsl.l - 55) * 0.2;

    return hueScore + satScore + lightnessScore;
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
 * Scales the boost based on available headroom to avoid washing out bright colors
 * @param {string} hexColor - Base hex color
 * @returns {string} Lightened hex color
 */
export function generateBrightVersion(hexColor) {
    const hsl = getColorHSL(hexColor);
    // Scale boost based on available headroom so bright colors don't wash out
    const headroom = 90 - hsl.l;
    const boost = Math.max(
        5,
        Math.min(BRIGHT_COLOR_LIGHTNESS_BOOST, headroom * 0.6)
    );
    const newLightness = Math.min(90, hsl.l + boost);
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

/**
 * Synthesizes an ANSI color when no good match exists in the image
 * Uses the average saturation and lightness of already-assigned colors
 * to create a color that fits the palette's visual mood
 *
 * @param {number} targetHue - Target ANSI hue (0-360)
 * @param {string[]} existingColors - Already-assigned ANSI colors
 * @returns {string} Synthesized hex color
 */
export function synthesizeAnsiColor(targetHue, existingColors) {
    let totalS = 0,
        totalL = 0,
        count = 0;

    for (const color of existingColors) {
        if (!color) continue;
        const hsl = getColorHSL(color);
        if (hsl.s >= ANSI_MIN_SATURATION_FOR_MATCH) {
            totalS += hsl.s;
            totalL += hsl.l;
            count++;
        }
    }

    // Fall back to reasonable defaults if no reference colors
    const avgS = count > 0 ? totalS / count : 50;
    const avgL = count > 0 ? totalL / count : 55;

    // Clamp to ensure the synthesized color is visually clear
    const synS = Math.max(35, Math.min(75, avgS));
    const synL = Math.max(40, Math.min(70, avgL));

    return hslToHex(targetHue, synS, synL);
}

/**
 * Finds optimal ANSI color assignments using global greedy matching
 * Instead of assigning colors sequentially (red first, then green, etc.),
 * this finds the globally best (ANSI slot, color) pair at each step,
 * preventing earlier slots from stealing good matches from later ones
 *
 * @param {string[]} colorPool - Available colors to choose from
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {Array<{poolIndex: number, score: number}|null>} Assignment for each ANSI slot (0-5)
 */
export function findOptimalAnsiAssignment(colorPool, usedIndices) {
    // Pre-compute and sort scores for all (ANSI slot, color) pairs
    const allScores = ANSI_HUE_ARRAY.map(targetHue => {
        return colorPool
            .map((color, poolIndex) => {
                if (usedIndices.has(poolIndex))
                    return {poolIndex, score: Infinity};
                const hsl = getColorHSL(color);
                return {poolIndex, score: calculateColorScore(hsl, targetHue)};
            })
            .sort((a, b) => a.score - b.score);
    });

    const assignments = new Array(6).fill(null);
    const assignedPoolIndices = new Set(usedIndices);

    // Iteratively assign the globally best pair
    for (let round = 0; round < 6; round++) {
        let bestAnsi = -1;
        let bestPoolIndex = -1;
        let bestScore = Infinity;

        for (let a = 0; a < 6; a++) {
            if (assignments[a] !== null) continue;
            // Find best unassigned candidate for this slot
            for (const candidate of allScores[a]) {
                if (assignedPoolIndices.has(candidate.poolIndex)) continue;
                if (candidate.score < bestScore) {
                    bestScore = candidate.score;
                    bestAnsi = a;
                    bestPoolIndex = candidate.poolIndex;
                }
                break; // First unassigned is best (list is sorted)
            }
        }

        if (bestAnsi === -1) break;
        assignments[bestAnsi] = {poolIndex: bestPoolIndex, score: bestScore};
        assignedPoolIndices.add(bestPoolIndex);
    }

    return assignments;
}
