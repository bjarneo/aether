import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {hexToRgb, rgbToHsl, hslToHex, rgbToHex} from './color-utils.js';
import {readFileAsText, writeTextToFile, fileExists, ensureDirectoryExists} from './file-utils.js';

/**
 * ImageMagick-based color extraction utility
 * Extracts dominant colors and generates ANSI palette with proper color mapping
 * Includes caching for improved performance
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of ANSI colors in a complete palette */
const ANSI_PALETTE_SIZE = 16;

/** Number of dominant colors to extract from image for analysis */
const DOMINANT_COLORS_TO_EXTRACT = 32;

/** Cache version number - increment when cache format changes */
const CACHE_VERSION = 1;

// Color detection thresholds
/** Saturation threshold below which a color is considered grayscale (0-100) */
const MONOCHROME_SATURATION_THRESHOLD = 15;

/** Percentage of low-saturation colors needed to classify image as monochrome (0-1) */
const MONOCHROME_IMAGE_THRESHOLD = 0.7;

/** Percentage of similar color pairs needed to classify as low diversity (0-1) */
const LOW_DIVERSITY_THRESHOLD = 0.6;

/** Hue difference (degrees) within which colors are considered similar (0-360) */
const SIMILAR_HUE_RANGE = 30;

/** Lightness difference (%) within which colors are considered similar (0-100) */
const SIMILAR_LIGHTNESS_RANGE = 20;

// Color quality preferences for chromatic extraction
/** Minimum saturation for chromatic ANSI colors (0-100) */
const MIN_CHROMATIC_SATURATION = 15;

/** Ideal saturation range for vibrant colors - lower bound (0-100) */
const IDEAL_SATURATION_MIN = 30;

/** Ideal saturation range for vibrant colors - upper bound (0-100) */
const IDEAL_SATURATION_MAX = 100;

/** Ideal lightness range for readable colors - lower bound (0-100) */
const IDEAL_LIGHTNESS_MIN = 30;

/** Ideal lightness range for readable colors - upper bound (0-100) */
const IDEAL_LIGHTNESS_MAX = 80;

/** Lightness below which a color is considered too dark (0-100) */
const TOO_DARK_THRESHOLD = 20;

/** Lightness above which a color is considered too bright (0-100) */
const TOO_BRIGHT_THRESHOLD = 85;

// Brightness normalization
/** Lightness below which background is considered very dark (0-100) */
const VERY_DARK_BACKGROUND_THRESHOLD = 20;

/** Lightness above which background is considered very light (0-100) */
const VERY_LIGHT_BACKGROUND_THRESHOLD = 80;

/** Minimum lightness for colors on very dark backgrounds (0-100) */
const MIN_LIGHTNESS_ON_DARK_BG = 55;

/** Maximum lightness for colors on very light backgrounds (0-100) */
const MAX_LIGHTNESS_ON_LIGHT_BG = 45;

/** Absolute minimum lightness to prevent invisible colors (0-100) */
const ABSOLUTE_MIN_LIGHTNESS = 25;

/** Lightness difference threshold for outlier detection (0-100) */
const OUTLIER_LIGHTNESS_THRESHOLD = 25;

/** Lightness threshold to determine if theme is bright vs dark (0-100) */
const BRIGHT_THEME_THRESHOLD = 50;

/** Lightness threshold to determine if a color is dark (0-100) */
const DARK_COLOR_THRESHOLD = 50;

// Palette generation settings
/** Base saturation for subtle balanced palettes (0-100) */
const SUBTLE_PALETTE_SATURATION = 28;

/** Saturation for monochrome palette colors (0-100) */
const MONOCHROME_SATURATION = 5;

/** Saturation multiplier for color8 in monochrome (0-1) */
const MONOCHROME_COLOR8_SATURATION_FACTOR = 0.5;

/** Lightness increase for bright ANSI colors (9-14) */
const BRIGHT_COLOR_LIGHTNESS_BOOST = 18;

/** Saturation multiplier for bright ANSI colors (9-14) */
const BRIGHT_COLOR_SATURATION_BOOST = 1.1;

// Standard ANSI color hues (in degrees, 0-360)
/** ANSI color hue targets for proper color mapping */
const ANSI_COLOR_HUES = {
    RED: 0,
    GREEN: 120,
    YELLOW: 60,
    BLUE: 240,
    MAGENTA: 300,
    CYAN: 180,
};

/** Ordered array of ANSI hue targets for colors 1-6 */
const ANSI_HUE_ARRAY = [
    ANSI_COLOR_HUES.RED,    // color1
    ANSI_COLOR_HUES.GREEN,  // color2
    ANSI_COLOR_HUES.YELLOW, // color3
    ANSI_COLOR_HUES.BLUE,   // color4
    ANSI_COLOR_HUES.MAGENTA,// color5
    ANSI_COLOR_HUES.CYAN,   // color6
];

// ImageMagick performance settings
/** Maximum image dimensions for fast processing */
const IMAGE_SCALE_SIZE = '800x600>';

/** Image quality for faster processing (0-100) */
const IMAGE_PROCESSING_QUALITY = 85;

/** Image bit depth */
const IMAGE_BIT_DEPTH = 8;

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Gets the cache directory for color extraction
 * @returns {string} Cache directory path
 */
function getCacheDir() {
    const homeDir = GLib.get_home_dir();
    return GLib.build_filenamev([homeDir, '.cache', 'aether', 'color-cache']);
}

/**
 * Generates a cache key based on image path and modification time
 * @param {string} imagePath - Path to the image
 * @param {boolean} lightMode - Light mode flag
 * @returns {string|null} Cache key or null if error
 */
function getCacheKey(imagePath, lightMode) {
    try {
        const file = Gio.File.new_for_path(imagePath);
        const info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
        const mtime = info.get_modification_date_time();
        const mtimeSeconds = mtime.to_unix();

        const dataString = `${imagePath}-${mtimeSeconds}-${lightMode ? 'light' : 'dark'}`;
        const checksum = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, dataString, -1);

        return checksum;
    } catch (e) {
        console.error('Error generating cache key:', e.message);
        return null;
    }
}

/**
 * Loads cached color palette if available
 * @param {string} cacheKey - Cache key
 * @returns {string[]|null} Cached palette or null
 */
function loadCachedPalette(cacheKey) {
    try {
        const cacheDir = getCacheDir();
        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);

        if (!fileExists(cachePath)) {
            return null;
        }

        const content = readFileAsText(cachePath);
        const data = JSON.parse(content);

        if (Array.isArray(data.palette) && data.palette.length === ANSI_PALETTE_SIZE) {
            console.log('Using cached color extraction result');
            return data.palette;
        }

        return null;
    } catch (e) {
        console.error('Error loading cache:', e.message);
        return null;
    }
}

/**
 * Saves color palette to cache
 * @param {string} cacheKey - Cache key
 * @param {string[]} palette - Color palette to cache
 */
function savePaletteToCache(cacheKey, palette) {
    try {
        const cacheDir = getCacheDir();
        ensureDirectoryExists(cacheDir);

        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);
        const data = {
            palette: palette,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };

        writeTextToFile(cachePath, JSON.stringify(data, null, 2));
        console.log('Saved color extraction to cache');
    } catch (e) {
        console.error('Error saving to cache:', e.message);
    }
}

// ============================================================================
// IMAGE MAGICK COLOR EXTRACTION
// ============================================================================

/**
 * Extracts the N most dominant colors from an image using ImageMagick
 * Optimized for speed with resize and quality settings
 * @param {string} imagePath - Path to the image file
 * @param {number} numColors - Number of colors to extract
 * @returns {Promise<string[]>} Array of hex colors sorted by dominance
 */
function extractDominantColors(imagePath, numColors) {
    return new Promise((resolve, reject) => {
        try {
            const argv = [
                'magick',
                imagePath,
                '-scale', IMAGE_SCALE_SIZE,
                '-colors', numColors.toString(),
                '-depth', IMAGE_BIT_DEPTH.toString(),
                '-quality', IMAGE_PROCESSING_QUALITY.toString(),
                '-format', '%c',
                'histogram:info:-',
            ];

            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (source, result) => {
                try {
                    const [, stdout, stderr] = source.communicate_utf8_finish(result);
                    const exitCode = source.get_exit_status();

                    if (exitCode !== 0) {
                        reject(new Error(`ImageMagick error: ${stderr}`));
                        return;
                    }

                    const colors = parseHistogramOutput(stdout);
                    if (colors.length === 0) {
                        reject(new Error('No colors extracted from image'));
                        return;
                    }

                    resolve(colors);
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Parses ImageMagick histogram output to extract hex colors
 * @param {string} output - Raw histogram output
 * @returns {string[]} Array of hex colors sorted by frequency (most dominant first)
 */
function parseHistogramOutput(output) {
    const lines = output.split('\n');
    const colorData = [];

    for (const line of lines) {
        const match = line.match(/^\s*(\d+):\s*\([^)]+\)\s*(#[0-9A-Fa-f]{6})/);
        if (match) {
            const count = parseInt(match[1], 10);
            const hex = match[2].toUpperCase();
            colorData.push({hex, count});
        }
    }

    colorData.sort((a, b) => b.count - a.count);
    return colorData.map(c => c.hex);
}

// ============================================================================
// COLOR ANALYSIS UTILITIES
// ============================================================================

/**
 * Determines if a color is considered "dark" based on lightness
 * @param {string} hexColor - Hex color string
 * @returns {boolean} True if dark, false if light
 */
function isDarkColor(hexColor) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hsl.l < DARK_COLOR_THRESHOLD;
}

/**
 * Extracts HSL values from a hex color
 * @param {string} hexColor - Hex color string
 * @returns {{h: number, s: number, l: number}} HSL object
 */
function getColorHSL(hexColor) {
    const rgb = hexToRgb(hexColor);
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculates circular hue distance between two hues
 * @param {number} hue1 - First hue (0-360)
 * @param {number} hue2 - Second hue (0-360)
 * @returns {number} Minimum distance between hues (0-180)
 */
function calculateHueDistance(hue1, hue2) {
    let diff = Math.abs(hue1 - hue2);
    if (diff > 180) diff = 360 - diff;
    return diff;
}

/**
 * Detects if the extracted colors are mostly monochrome/grayscale
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if mostly monochrome
 */
function isMonochromeImage(colors) {
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
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if colors lack diversity
 */
function hasLowColorDiversity(colors) {
    const hslColors = colors.map(color => {
        const hsl = getColorHSL(color);
        return {hue: hsl.h, saturation: hsl.s, lightness: hsl.l};
    });

    let similarCount = 0;
    let totalComparisons = 0;

    for (let i = 0; i < hslColors.length; i++) {
        for (let j = i + 1; j < hslColors.length; j++) {
            const color1 = hslColors[i];
            const color2 = hslColors[j];

            // Skip grayscale colors
            if (color1.saturation < MONOCHROME_SATURATION_THRESHOLD ||
                color2.saturation < MONOCHROME_SATURATION_THRESHOLD) {
                continue;
            }

            totalComparisons++;

            const hueDiff = calculateHueDistance(color1.hue, color2.hue);
            const lightnessDiff = Math.abs(color1.lightness - color2.lightness);

            if (hueDiff < SIMILAR_HUE_RANGE && lightnessDiff < SIMILAR_LIGHTNESS_RANGE) {
                similarCount++;
            }
        }
    }

    if (totalComparisons === 0) return false;

    return similarCount / totalComparisons > LOW_DIVERSITY_THRESHOLD;
}

// ============================================================================
// COLOR SELECTION AND MATCHING
// ============================================================================

/**
 * Finds background color - darkest or lightest based on mode
 * @param {string[]} colors - Array of hex colors
 * @param {boolean} lightMode - Light mode flag
 * @returns {{color: string, index: number}} Background color and its index
 */
function findBackgroundColor(colors, lightMode) {
    let bgIndex = 0;
    let bgLightness = lightMode ? -1 : 101;

    for (let i = 0; i < colors.length; i++) {
        const hsl = getColorHSL(colors[i]);

        if (lightMode) {
            if (hsl.l > bgLightness) {
                bgLightness = hsl.l;
                bgIndex = i;
            }
        } else {
            if (hsl.l < bgLightness) {
                bgLightness = hsl.l;
                bgIndex = i;
            }
        }
    }

    return {color: colors[bgIndex], index: bgIndex};
}

/**
 * Finds foreground color - opposite of background
 * @param {string[]} colors - Array of hex colors
 * @param {boolean} lightMode - Light mode flag
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {{color: string, index: number}} Foreground color and its index
 */
function findForegroundColor(colors, lightMode, usedIndices) {
    let fgIndex = 0;
    let fgLightness = lightMode ? 101 : -1;

    for (let i = 0; i < colors.length; i++) {
        if (usedIndices.has(i)) continue;

        const hsl = getColorHSL(colors[i]);

        if (lightMode) {
            if (hsl.l < fgLightness) {
                fgLightness = hsl.l;
                fgIndex = i;
            }
        } else {
            if (hsl.l > fgLightness) {
                fgLightness = hsl.l;
                fgIndex = i;
            }
        }
    }

    return {color: colors[fgIndex], index: fgIndex};
}

/**
 * Calculates color quality score for ANSI color selection
 * Prioritizes hue accuracy to stay close to extracted colors
 * @param {{h: number, s: number, l: number}} hsl - HSL color values
 * @param {number} targetHue - Target hue (0-360)
 * @returns {number} Score (lower is better)
 */
function calculateColorScore(hsl, targetHue) {
    // Hue difference is the primary factor - multiply by 3 to prioritize it
    const hueDiff = calculateHueDistance(hsl.h, targetHue) * 3;

    // Only penalize extremely desaturated colors
    const saturationPenalty = hsl.s < MIN_CHROMATIC_SATURATION ? 50 : 0;

    // Very minimal lightness penalties - just avoid extremes
    let lightnessPenalty = 0;
    if (hsl.l < TOO_DARK_THRESHOLD) {
        lightnessPenalty = 10;
    } else if (hsl.l > TOO_BRIGHT_THRESHOLD) {
        lightnessPenalty = 10;
    }

    // Hue is 3x more important than other factors
    return hueDiff + saturationPenalty + lightnessPenalty;
}

/**
 * Finds the best matching color for a specific ANSI color role
 * @param {number} targetHue - Target hue (0-360)
 * @param {string[]} colorPool - Available colors to choose from
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {number} Index of best match in colorPool
 */
function findBestColorMatch(targetHue, colorPool, usedIndices) {
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

// ============================================================================
// COLOR GENERATION UTILITIES
// ============================================================================

/**
 * Generates a lighter version of a color for bright ANSI slots
 * @param {string} hexColor - Base hex color
 * @returns {string} Lightened hex color
 */
function generateBrightVersion(hexColor) {
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
function adjustColorLightness(hexColor, targetLightness) {
    const hsl = getColorHSL(hexColor);
    return hslToHex(hsl.h, hsl.s, targetLightness);
}

/**
 * Sorts colors by lightness
 * @param {string[]} colors - Array of hex colors
 * @returns {Array<{color: string, lightness: number, hue: number}>} Sorted color data
 */
function sortColorsByLightness(colors) {
    return colors
        .map(color => {
            const hsl = getColorHSL(color);
            return {color, lightness: hsl.l, hue: hsl.h};
        })
        .sort((a, b) => a.lightness - b.lightness);
}

// ============================================================================
// PALETTE GENERATORS
// ============================================================================

/**
 * Generates a subtle, balanced chromatic palette for low-diversity images
 * All colors get similar saturation levels to avoid imbalance
 * @param {string[]} dominantColors - Array of dominant colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 ANSI colors with balanced saturation
 */
function generateSubtleBalancedPalette(dominantColors, lightMode) {
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    // Calculate average hue from chromatic colors
    const chromaticColors = dominantColors.filter(c => getColorHSL(c).s > MONOCHROME_SATURATION_THRESHOLD);
    const avgHue = chromaticColors.length > 0
        ? chromaticColors.reduce((sum, c) => sum + getColorHSL(c).h, 0) / chromaticColors.length
        : darkest.hue;

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground
    palette[0] = lightMode ? lightest.color : darkest.color;
    palette[7] = lightMode ? darkest.color : lightest.color;

    // Generate ANSI colors 1-6 with balanced subtle saturation
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const lightness = 50 + (i - 2.5) * 4; // Vary slightly (42-58%)
        palette[i + 1] = hslToHex(ANSI_HUE_ARRAY[i], SUBTLE_PALETTE_SATURATION, lightness);
    }

    // Color 8: gray between background and colors
    const color8Lightness = lightMode
        ? Math.max(0, lightest.lightness - 20)
        : Math.min(100, darkest.lightness + 20);
    palette[8] = hslToHex(avgHue, SUBTLE_PALETTE_SATURATION * 0.5, color8Lightness);

    // Colors 9-14: Slightly more saturated versions of 1-6
    const brightSaturation = SUBTLE_PALETTE_SATURATION + 8;
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const baseLightness = 50 + (i - 2.5) * 4;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(0, Math.min(100, baseLightness + adjustment));
        palette[i + 9] = hslToHex(ANSI_HUE_ARRAY[i], brightSaturation, lightness);
    }

    // Color 15: Bright foreground
    palette[15] = lightMode
        ? hslToHex(avgHue, SUBTLE_PALETTE_SATURATION * 0.3, Math.max(0, darkest.lightness - 5))
        : hslToHex(avgHue, SUBTLE_PALETTE_SATURATION * 0.3, Math.min(100, lightest.lightness + 5));

    return palette;
}

/**
 * Generates a monochrome/grayscale ANSI palette
 * @param {string[]} grayColors - Array of grayscale colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 monochrome ANSI colors
 */
function generateMonochromePalette(grayColors, lightMode) {
    const sortedByLightness = sortColorsByLightness(grayColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];
    const baseHue = darkest.hue;

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground
    palette[0] = lightMode ? lightest.color : darkest.color;
    palette[7] = lightMode ? darkest.color : lightest.color;

    // Generate grayscale shades for ANSI colors 1-6
    if (lightMode) {
        // Light mode: darker shades for light background
        const startL = darkest.lightness + 10;
        const endL = Math.min(darkest.lightness + 40, lightest.lightness - 10);
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
        }
    } else {
        // Dark mode: lighter shades for dark background
        const startL = Math.max(darkest.lightness + 30, lightest.lightness - 40);
        const endL = lightest.lightness - 10;
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
        }
    }

    // Color 8: gray between background and colors
    const color8Lightness = lightMode
        ? Math.max(0, darkest.lightness + 5)
        : Math.min(100, lightest.lightness - 25);
    palette[8] = hslToHex(baseHue, MONOCHROME_SATURATION * MONOCHROME_COLOR8_SATURATION_FACTOR, color8Lightness);

    // Colors 9-14: Slightly lighter/darker versions of 1-6
    for (let i = 1; i <= 6; i++) {
        const hsl = getColorHSL(palette[i]);
        const adjustment = lightMode ? -10 : 10;
        const newL = Math.max(0, Math.min(100, hsl.l + adjustment));
        palette[i + 8] = hslToHex(baseHue, MONOCHROME_SATURATION, newL);
    }

    // Color 15: Bright white/black
    palette[15] = lightMode
        ? hslToHex(baseHue, 2, Math.max(0, darkest.lightness - 5))
        : hslToHex(baseHue, 2, Math.min(100, lightest.lightness + 5));

    return palette;
}

/**
 * Normalizes brightness of ANSI colors to ensure readability
 * Adjusts colors based on background brightness and overall theme
 * @param {string[]} palette - Palette with colors 0-15
 * @returns {string[]} Normalized palette
 */
function normalizeBrightness(palette) {
    const bgHsl = getColorHSL(palette[0]);
    const bgLightness = bgHsl.l;

    const isVeryDarkBg = bgLightness < VERY_DARK_BACKGROUND_THRESHOLD;
    const isVeryLightBg = bgLightness > VERY_LIGHT_BACKGROUND_THRESHOLD;

    // Analyze colors 1-7
    const colorIndices = [1, 2, 3, 4, 5, 6, 7];
    const ansiColors = colorIndices.map(i => {
        const hsl = getColorHSL(palette[i]);
        return {index: i, lightness: hsl.l, hue: hsl.h, saturation: hsl.s};
    });

    const avgLightness = ansiColors.reduce((sum, c) => sum + c.lightness, 0) / ansiColors.length;
    const isBrightTheme = avgLightness > BRIGHT_THEME_THRESHOLD;

    if (isVeryDarkBg) {
        // Very dark background - ensure all colors are bright enough
        for (const colorInfo of ansiColors) {
            if (colorInfo.lightness < MIN_LIGHTNESS_ON_DARK_BG) {
                const adjustedLightness = MIN_LIGHTNESS_ON_DARK_BG + (colorInfo.index * 3);
                console.log(`Adjusting color ${colorInfo.index} for dark background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);

                palette[colorInfo.index] = adjustColorLightness(palette[colorInfo.index], adjustedLightness);

                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    palette[colorInfo.index + 8] = generateBrightVersion(palette[colorInfo.index]);
                }
            }
        }
    } else if (isVeryLightBg) {
        // Very light background - ensure all colors are dark enough
        for (const colorInfo of ansiColors) {
            if (colorInfo.lightness > MAX_LIGHTNESS_ON_LIGHT_BG) {
                const adjustedLightness = Math.max(ABSOLUTE_MIN_LIGHTNESS, MAX_LIGHTNESS_ON_LIGHT_BG - (colorInfo.index * 2));
                console.log(`Adjusting color ${colorInfo.index} for light background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);

                palette[colorInfo.index] = adjustColorLightness(palette[colorInfo.index], adjustedLightness);

                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    palette[colorInfo.index + 8] = generateBrightVersion(palette[colorInfo.index]);
                }
            }
        }
    } else {
        // Normal background - apply outlier detection
        const outliers = ansiColors.filter(c =>
            Math.abs(c.lightness - avgLightness) > OUTLIER_LIGHTNESS_THRESHOLD
        );

        for (const outlier of outliers) {
            let adjustedLightness;

            if (isBrightTheme && outlier.lightness < avgLightness - OUTLIER_LIGHTNESS_THRESHOLD) {
                adjustedLightness = avgLightness - 10;
                console.log(`Adjusting dark outlier color ${outlier.index}: ${outlier.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);
            } else if (!isBrightTheme && outlier.lightness > avgLightness + OUTLIER_LIGHTNESS_THRESHOLD) {
                adjustedLightness = avgLightness + 10;
                console.log(`Adjusting bright outlier color ${outlier.index}: ${outlier.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);
            } else {
                continue;
            }

            palette[outlier.index] = adjustColorLightness(palette[outlier.index], adjustedLightness);

            if (outlier.index >= 1 && outlier.index <= 6) {
                palette[outlier.index + 8] = generateBrightVersion(palette[outlier.index]);
            }
        }
    }

    return palette;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extracts colors from wallpaper using ImageMagick and generates ANSI palette
 * Uses caching to avoid re-processing the same image
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {Promise<string[]>} Array of 16 ANSI colors
 */
export async function extractColorsWithImageMagick(imagePath, lightMode = false) {
    try {
        // Check cache first
        const cacheKey = getCacheKey(imagePath, lightMode);
        if (cacheKey) {
            const cachedPalette = loadCachedPalette(cacheKey);
            if (cachedPalette) {
                return cachedPalette;
            }
        }

        // Extract dominant colors
        const dominantColors = await extractDominantColors(imagePath, DOMINANT_COLORS_TO_EXTRACT);

        if (dominantColors.length < 8) {
            throw new Error('Not enough colors extracted from image');
        }

        let palette;

        // Generate palette based on image characteristics
        if (isMonochromeImage(dominantColors)) {
            console.log('Detected monochrome/grayscale image - generating grayscale palette');
            palette = generateMonochromePalette(dominantColors, lightMode);
        } else if (hasLowColorDiversity(dominantColors)) {
            console.log('Detected low color diversity - generating subtle balanced palette');
            palette = generateSubtleBalancedPalette(dominantColors, lightMode);
        } else {
            console.log('Detected diverse chromatic image - generating vibrant colorful palette');
            palette = generateChromaticPalette(dominantColors, lightMode);
        }

        // Normalize brightness for readability
        palette = normalizeBrightness(palette);

        // Save to cache
        if (cacheKey) {
            savePaletteToCache(cacheKey, palette);
        }

        return palette;
    } catch (e) {
        throw new Error(`ImageMagick color extraction failed: ${e.message}`);
    }
}

/**
 * Generates a vibrant chromatic palette from diverse colors
 * @param {string[]} dominantColors - Array of dominant colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 ANSI colors
 */
function generateChromaticPalette(dominantColors, lightMode) {
    const background = findBackgroundColor(dominantColors, lightMode);
    const usedIndices = new Set([background.index]);

    const foreground = findForegroundColor(dominantColors, lightMode, usedIndices);
    usedIndices.add(foreground.index);

    const palette = new Array(ANSI_PALETTE_SIZE);
    palette[0] = background.color;
    palette[7] = foreground.color;

    // Find best matches for ANSI colors 1-6
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const matchIndex = findBestColorMatch(ANSI_HUE_ARRAY[i], dominantColors, usedIndices);
        palette[i + 1] = dominantColors[matchIndex];
        usedIndices.add(matchIndex);
    }

    // Generate color8 (bright black/gray)
    const bgHsl = getColorHSL(background.color);
    const color8Lightness = isDarkColor(background.color)
        ? Math.min(100, bgHsl.l + 20)
        : Math.max(0, bgHsl.l - 20);
    palette[8] = hslToHex(bgHsl.h, bgHsl.s * 0.5, color8Lightness);

    // Generate bright versions (9-14) of colors 1-6
    for (let i = 1; i <= 6; i++) {
        palette[i + 8] = generateBrightVersion(palette[i]);
    }

    // Generate color15 (bright white)
    palette[15] = generateBrightVersion(foreground.color);

    return palette;
}

/**
 * Callback-based wrapper for extractColorsWithImageMagick
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @param {Function} onSuccess - Callback when colors are extracted
 * @param {Function} onError - Callback when extraction fails
 */
export function extractColorsFromWallpaperIM(imagePath, lightMode, onSuccess, onError) {
    extractColorsWithImageMagick(imagePath, lightMode)
        .then(colors => onSuccess(colors))
        .catch(error => onError(error));
}
