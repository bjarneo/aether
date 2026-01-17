import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import {hexToRgb, rgbToHsl, hslToHex, rgbToHex} from './color-utils.js';
import {
    readFileAsText,
    writeTextToFile,
    fileExists,
    ensureDirectoryExists,
} from './file-utils.js';

/**
 * Native GdkPixbuf-based color extraction utility
 * Extracts dominant colors using median-cut algorithm and generates ANSI palette
 * No external dependencies required (uses GTK's built-in image loading)
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
    ANSI_COLOR_HUES.RED, // color1
    ANSI_COLOR_HUES.GREEN, // color2
    ANSI_COLOR_HUES.YELLOW, // color3
    ANSI_COLOR_HUES.BLUE, // color4
    ANSI_COLOR_HUES.MAGENTA, // color5
    ANSI_COLOR_HUES.CYAN, // color6
];

// Native extraction settings
/** Maximum image dimension for fast processing (pixels) */
const IMAGE_SCALE_SIZE = 200;

/** Minimum pixels to sample for reliable color extraction */
const MIN_PIXELS_TO_SAMPLE = 1000;

/** Maximum pixels to sample (for very large images) */
const MAX_PIXELS_TO_SAMPLE = 40000;

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
        const info = file.query_info(
            'time::modified',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        const mtime = info.get_modification_date_time();
        const mtimeSeconds = mtime.to_unix();

        const dataString = `${imagePath}-${mtimeSeconds}-${lightMode ? 'light' : 'dark'}`;
        const checksum = GLib.compute_checksum_for_string(
            GLib.ChecksumType.MD5,
            dataString,
            -1
        );

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

        if (
            Array.isArray(data.palette) &&
            data.palette.length === ANSI_PALETTE_SIZE
        ) {
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
// NATIVE GDKPIXBUF COLOR EXTRACTION
// ============================================================================

/**
 * Loads an image and extracts pixel data using GdkPixbuf
 * @param {string} imagePath - Path to the image file
 * @returns {{pixels: Uint8Array, width: number, height: number, channels: number, rowstride: number}}
 */
function loadImagePixels(imagePath) {
    // Load and scale image for faster processing
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
        imagePath,
        IMAGE_SCALE_SIZE,
        IMAGE_SCALE_SIZE,
        true // preserve aspect ratio
    );

    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    const channels = pixbuf.get_n_channels();
    const rowstride = pixbuf.get_rowstride();
    const pixels = pixbuf.get_pixels();

    return {pixels, width, height, channels, rowstride};
}

/**
 * Samples pixels from image data and returns RGB color array
 * @param {Object} imageData - Image data from loadImagePixels
 * @returns {Array<{r: number, g: number, b: number}>} Array of RGB colors
 */
function samplePixels(imageData) {
    const {pixels, width, height, channels, rowstride} = imageData;
    const colors = [];

    // Calculate sampling rate to stay within bounds
    const totalPixels = width * height;
    const sampleRate = Math.max(
        1,
        Math.floor(totalPixels / MAX_PIXELS_TO_SAMPLE)
    );

    for (let y = 0; y < height; y += sampleRate) {
        for (let x = 0; x < width; x += sampleRate) {
            const offset = y * rowstride + x * channels;
            const r = pixels[offset];
            const g = pixels[offset + 1];
            const b = pixels[offset + 2];

            // Skip fully transparent pixels if alpha channel exists
            if (channels === 4 && pixels[offset + 3] < 128) {
                continue;
            }

            colors.push({r, g, b});
        }
    }

    return colors;
}

/**
 * Represents a color bucket for median-cut algorithm
 */
class ColorBucket {
    constructor(colors) {
        this.colors = colors;
        this._updateStats();
    }

    _updateStats() {
        if (this.colors.length === 0) {
            this.rMin = this.rMax = 0;
            this.gMin = this.gMax = 0;
            this.bMin = this.bMax = 0;
            return;
        }

        this.rMin = this.rMax = this.colors[0].r;
        this.gMin = this.gMax = this.colors[0].g;
        this.bMin = this.bMax = this.colors[0].b;

        for (const color of this.colors) {
            this.rMin = Math.min(this.rMin, color.r);
            this.rMax = Math.max(this.rMax, color.r);
            this.gMin = Math.min(this.gMin, color.g);
            this.gMax = Math.max(this.gMax, color.g);
            this.bMin = Math.min(this.bMin, color.b);
            this.bMax = Math.max(this.bMax, color.b);
        }
    }

    /**
     * Returns the channel with the widest range
     * @returns {'r'|'g'|'b'}
     */
    getLongestChannel() {
        const rRange = this.rMax - this.rMin;
        const gRange = this.gMax - this.gMin;
        const bRange = this.bMax - this.bMin;

        if (rRange >= gRange && rRange >= bRange) return 'r';
        if (gRange >= rRange && gRange >= bRange) return 'g';
        return 'b';
    }

    /**
     * Splits bucket along the longest channel
     * @returns {[ColorBucket, ColorBucket]}
     */
    split() {
        const channel = this.getLongestChannel();

        // Sort by the longest channel
        this.colors.sort((a, b) => a[channel] - b[channel]);

        const midpoint = Math.floor(this.colors.length / 2);
        const left = this.colors.slice(0, midpoint);
        const right = this.colors.slice(midpoint);

        return [new ColorBucket(left), new ColorBucket(right)];
    }

    /**
     * Returns the average color of this bucket
     * @returns {{r: number, g: number, b: number, count: number}}
     */
    getAverageColor() {
        if (this.colors.length === 0) {
            return {r: 0, g: 0, b: 0, count: 0};
        }

        let rSum = 0,
            gSum = 0,
            bSum = 0;
        for (const color of this.colors) {
            rSum += color.r;
            gSum += color.g;
            bSum += color.b;
        }

        const count = this.colors.length;
        return {
            r: Math.round(rSum / count),
            g: Math.round(gSum / count),
            b: Math.round(bSum / count),
            count: count,
        };
    }

    /**
     * Returns the volume of this bucket (for priority queue)
     * @returns {number}
     */
    getVolume() {
        return (
            (this.rMax - this.rMin) *
            (this.gMax - this.gMin) *
            (this.bMax - this.bMin) *
            this.colors.length
        );
    }
}

/**
 * Implements median-cut color quantization algorithm
 * @param {Array<{r: number, g: number, b: number}>} colors - Array of RGB colors
 * @param {number} numColors - Target number of colors
 * @returns {Array<{r: number, g: number, b: number, count: number}>} Quantized colors
 */
function medianCut(colors, numColors) {
    if (colors.length === 0) {
        return [];
    }

    if (colors.length <= numColors) {
        // Not enough colors to quantize, return unique colors
        const seen = new Set();
        const unique = [];
        for (const c of colors) {
            const key = `${c.r},${c.g},${c.b}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push({...c, count: 1});
            }
        }
        return unique;
    }

    // Start with one bucket containing all colors
    let buckets = [new ColorBucket(colors)];

    // Split until we have enough buckets
    while (buckets.length < numColors) {
        // Find the bucket with the largest volume to split
        let maxVolume = -1;
        let maxIndex = 0;

        for (let i = 0; i < buckets.length; i++) {
            const volume = buckets[i].getVolume();
            if (volume > maxVolume && buckets[i].colors.length > 1) {
                maxVolume = volume;
                maxIndex = i;
            }
        }

        // If no bucket can be split, stop
        if (maxVolume <= 0) break;

        // Split the largest bucket
        const [left, right] = buckets[maxIndex].split();
        buckets.splice(maxIndex, 1, left, right);
    }

    // Get average color from each bucket
    return buckets
        .map(bucket => bucket.getAverageColor())
        .filter(c => c.count > 0);
}

/**
 * Extracts the N most dominant colors from an image using GdkPixbuf
 * Uses median-cut algorithm for color quantization
 * @param {string} imagePath - Path to the image file
 * @param {number} numColors - Number of colors to extract
 * @returns {Promise<string[]>} Array of hex colors sorted by dominance
 */
function extractDominantColors(imagePath, numColors) {
    return new Promise((resolve, reject) => {
        try {
            // Load image and get pixel data
            const imageData = loadImagePixels(imagePath);

            // Sample pixels from the image
            const pixels = samplePixels(imageData);

            if (pixels.length < MIN_PIXELS_TO_SAMPLE / 10) {
                reject(new Error('Not enough pixels to extract colors'));
                return;
            }

            // Run median-cut quantization
            const quantizedColors = medianCut(pixels, numColors);

            if (quantizedColors.length === 0) {
                reject(new Error('No colors extracted from image'));
                return;
            }

            // Sort by count (dominance) and convert to hex
            quantizedColors.sort((a, b) => b.count - a.count);

            const hexColors = quantizedColors.map(c => {
                const hex = rgbToHex(c.r, c.g, c.b);
                return hex.toUpperCase();
            });

            resolve(hexColors);
        } catch (e) {
            reject(new Error(`Color extraction failed: ${e.message}`));
        }
    });
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
 * Uses optimized hue bucketing instead of O(n²) pairwise comparison
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if colors lack diversity
 */
function hasLowColorDiversity(colors) {
    // Sample first 16 colors for faster analysis (dominant colors are sorted by frequency)
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

    // Use hue bucketing for O(n) complexity instead of O(n²)
    // Divide the hue wheel into 12 buckets (30 degrees each, matching SIMILAR_HUE_RANGE)
    const hueBuckets = new Array(12).fill(0);
    const HUE_BUCKET_SIZE = 30;

    for (const color of chromaticColors) {
        const bucket = Math.floor(color.hue / HUE_BUCKET_SIZE) % 12;
        hueBuckets[bucket]++;
    }

    // Count how many buckets have colors
    const occupiedBuckets = hueBuckets.filter(count => count > 0).length;

    // If colors are spread across fewer than 3 hue buckets, they lack diversity
    // With 12 buckets, having colors in only 1-2 buckets means low diversity
    return occupiedBuckets < 3;
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
 * Prioritizes hue accuracy, then favors more saturated colors
 * @param {{h: number, s: number, l: number}} hsl - HSL color values
 * @param {number} targetHue - Target hue (0-360)
 * @returns {number} Score (lower is better)
 */
function calculateColorScore(hsl, targetHue) {
    // Hue difference is the primary factor - multiply by 3 to prioritize it
    const hueDiff = calculateHueDistance(hsl.h, targetHue) * 3;

    // Heavily penalize extremely desaturated colors
    const saturationPenalty = hsl.s < MIN_CHROMATIC_SATURATION ? 50 : 0;

    // Reward higher saturation: prefer stronger colors when hues are similar
    // Invert saturation (100 - s) so lower score = better (more saturated)
    // Divide by 2 to keep it less important than hue accuracy
    const saturationReward = (100 - hsl.s) / 2;

    // Very minimal lightness penalties - just avoid extremes
    let lightnessPenalty = 0;
    if (hsl.l < TOO_DARK_THRESHOLD) {
        lightnessPenalty = 10;
    } else if (hsl.l > TOO_BRIGHT_THRESHOLD) {
        lightnessPenalty = 10;
    }

    // Priority: Hue (3x) > Saturation preference > Lightness extremes
    return hueDiff + saturationPenalty + saturationReward + lightnessPenalty;
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
    const chromaticColors = dominantColors.filter(
        c => getColorHSL(c).s > MONOCHROME_SATURATION_THRESHOLD
    );
    const avgHue =
        chromaticColors.length > 0
            ? chromaticColors.reduce((sum, c) => sum + getColorHSL(c).h, 0) /
              chromaticColors.length
            : darkest.hue;

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground
    palette[0] = lightMode ? lightest.color : darkest.color;
    palette[7] = lightMode ? darkest.color : lightest.color;

    // Generate ANSI colors 1-6 with balanced subtle saturation
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const lightness = 50 + (i - 2.5) * 4; // Vary slightly (42-58%)
        palette[i + 1] = hslToHex(
            ANSI_HUE_ARRAY[i],
            SUBTLE_PALETTE_SATURATION,
            lightness
        );
    }

    // Color 8: gray for comments - brighter in dark mode, darker in light mode
    const color8Lightness = lightMode
        ? Math.max(0, lightest.lightness - 40)
        : Math.min(100, darkest.lightness + 45);
    palette[8] = hslToHex(
        avgHue,
        SUBTLE_PALETTE_SATURATION * 0.5,
        color8Lightness
    );

    // Colors 9-14: Slightly more saturated versions of 1-6
    const brightSaturation = SUBTLE_PALETTE_SATURATION + 8;
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const baseLightness = 50 + (i - 2.5) * 4;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(
            0,
            Math.min(100, baseLightness + adjustment)
        );
        palette[i + 9] = hslToHex(
            ANSI_HUE_ARRAY[i],
            brightSaturation,
            lightness
        );
    }

    // Color 15: Bright foreground
    palette[15] = lightMode
        ? hslToHex(
              avgHue,
              SUBTLE_PALETTE_SATURATION * 0.3,
              Math.max(0, darkest.lightness - 5)
          )
        : hslToHex(
              avgHue,
              SUBTLE_PALETTE_SATURATION * 0.3,
              Math.min(100, lightest.lightness + 5)
          );

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
        const startL = Math.max(
            darkest.lightness + 30,
            lightest.lightness - 40
        );
        const endL = lightest.lightness - 10;
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
        }
    }

    // Color 8: gray for comments - brighter in dark mode, darker in light mode
    const color8Lightness = lightMode
        ? Math.max(0, darkest.lightness + 5)
        : Math.min(100, lightest.lightness - 10);
    palette[8] = hslToHex(
        baseHue,
        MONOCHROME_SATURATION * MONOCHROME_COLOR8_SATURATION_FACTOR,
        color8Lightness
    );

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
 * Generates a monochromatic ANSI palette based on dominant hue from image
 * Creates variations of a single hue with different saturation and lightness
 * @param {string[]} dominantColors - Array of dominant colors from image (sorted by frequency)
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 monochromatic ANSI colors
 */
function generateMonochromaticPalette(dominantColors, lightMode) {
    // Find the most frequent color that has decent saturation
    // dominantColors is sorted by frequency, so we prioritize common colors
    let baseColor = null;

    // First try: Find most common color with good saturation (>15%)
    for (const color of dominantColors) {
        const hsl = getColorHSL(color);
        if (hsl.s > MONOCHROME_SATURATION_THRESHOLD) {
            baseColor = {color, hsl};
            break;
        }
    }

    // Fallback: Use the most common color regardless of saturation
    if (!baseColor) {
        baseColor = {
            color: dominantColors[0],
            hsl: getColorHSL(dominantColors[0]),
        };
    }

    const baseHue = baseColor.hsl.h;

    // Sort all colors by lightness for background/foreground
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground using base hue but with appropriate lightness
    if (lightMode) {
        // Light background, dark foreground
        palette[0] = hslToHex(baseHue, 8, Math.max(85, lightest.lightness));
        palette[7] = hslToHex(
            baseHue,
            25,
            Math.min(30, darkest.lightness + 10)
        );
    } else {
        // Dark background, light foreground
        palette[0] = hslToHex(baseHue, 15, Math.min(15, darkest.lightness));
        palette[7] = hslToHex(
            baseHue,
            10,
            Math.max(80, lightest.lightness - 10)
        );
    }

    // Generate ANSI colors 1-6 with the base hue but varying saturation and lightness
    // We'll create a monochromatic gradient with different intensities
    const saturationLevels = [40, 50, 45, 55, 42, 48]; // Varied saturation for interest
    const lightnessBase = lightMode ? 45 : 55;

    for (let i = 0; i < 6; i++) {
        const lightness = lightnessBase + (i - 2.5) * 5; // Range around base
        palette[i + 1] = hslToHex(baseHue, saturationLevels[i], lightness);
    }

    // Color 8: Muted version for comments - darker in light mode, brighter in dark mode
    const color8Lightness = lightMode ? 40 : 65;
    palette[8] = hslToHex(baseHue, 20, color8Lightness);

    // Colors 9-14: Brighter/more saturated versions of 1-6
    const brightSaturationLevels = [60, 70, 65, 75, 62, 68];
    for (let i = 0; i < 6; i++) {
        const baseLightness = lightnessBase + (i - 2.5) * 5;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(
            0,
            Math.min(100, baseLightness + adjustment)
        );
        palette[i + 9] = hslToHex(
            baseHue,
            brightSaturationLevels[i],
            lightness
        );
    }

    // Color 15: Bright foreground (more saturated than color 7)
    if (lightMode) {
        palette[15] = hslToHex(
            baseHue,
            30,
            Math.min(25, darkest.lightness + 5)
        );
    } else {
        palette[15] = hslToHex(baseHue, 15, Math.max(85, lightest.lightness));
    }

    return palette;
}

/**
 * Generates a pastel color palette (low saturation, high lightness)
 * Creates soft, muted colors from image hues
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 pastel ANSI colors
 */
function generatePastelPalette(dominantColors, lightMode) {
    const palette = generateChromaticPalette(dominantColors, lightMode);

    // Convert all colors to pastel (low saturation, high lightness)
    return palette.map((color, index) => {
        const hsl = getColorHSL(color);

        if (index === 0) {
            // Background: very light and desaturated
            return lightMode
                ? hslToHex(hsl.h, 10, 95)
                : hslToHex(hsl.h, 15, 20);
        } else if (index === 7 || index === 15) {
            // Foreground: darker but still pastel
            return lightMode
                ? hslToHex(hsl.h, 25, 35)
                : hslToHex(hsl.h, 20, 75);
        } else if (index === 8) {
            // Comment gray: pastel
            return lightMode
                ? hslToHex(hsl.h, 15, 65)
                : hslToHex(hsl.h, 12, 45);
        } else {
            // ANSI colors: pastel with moderate saturation
            const pastelSaturation = Math.min(35, hsl.s);
            const pastelLightness = lightMode ? 50 : 70;
            return hslToHex(hsl.h, pastelSaturation, pastelLightness);
        }
    });
}

/**
 * Generates a highly saturated, vibrant colorful palette
 * Maximizes color saturation for bold, eye-catching themes
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 colorful ANSI colors
 */
function generateColorfulPalette(dominantColors, lightMode) {
    const palette = generateChromaticPalette(dominantColors, lightMode);

    // Boost saturation for all colors to maximum vibrancy
    return palette.map((color, index) => {
        const hsl = getColorHSL(color);

        if (index === 0) {
            // Background: keep relatively neutral but add slight hue
            return lightMode ? hslToHex(hsl.h, 8, 98) : hslToHex(hsl.h, 12, 8);
        } else if (index === 7 || index === 15) {
            // Foreground: high contrast with subtle saturation
            return lightMode
                ? hslToHex(hsl.h, 15, 10)
                : hslToHex(hsl.h, 10, 95);
        } else if (index === 8) {
            // Comment gray: desaturated but visible
            return lightMode
                ? hslToHex(hsl.h, 20, 50)
                : hslToHex(hsl.h, 15, 55);
        } else {
            // ANSI colors: maximum saturation with proper lightness
            const colorfulSaturation = Math.max(75, Math.min(95, hsl.s + 30));
            const colorfulLightness = lightMode
                ? Math.max(35, Math.min(55, hsl.l))
                : Math.max(55, Math.min(70, hsl.l));
            return hslToHex(hsl.h, colorfulSaturation, colorfulLightness);
        }
    });
}

/**
 * Generates a desaturated, muted palette with subdued colors
 * Creates calm, professional themes with low saturation
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 muted ANSI colors
 */
function generateMutedPalette(dominantColors, lightMode) {
    const palette = generateChromaticPalette(dominantColors, lightMode);

    // Reduce saturation for all colors to create muted tones
    return palette.map((color, index) => {
        const hsl = getColorHSL(color);

        if (index === 0) {
            // Background: very desaturated
            return lightMode ? hslToHex(hsl.h, 5, 95) : hslToHex(hsl.h, 8, 15);
        } else if (index === 7 || index === 15) {
            // Foreground: minimal saturation
            return lightMode ? hslToHex(hsl.h, 10, 20) : hslToHex(hsl.h, 8, 85);
        } else if (index === 8) {
            // Comment gray: very muted
            return lightMode ? hslToHex(hsl.h, 8, 60) : hslToHex(hsl.h, 6, 50);
        } else {
            // ANSI colors: low saturation, maintain hue diversity
            const mutedSaturation = Math.max(15, Math.min(35, hsl.s * 0.5));
            const mutedLightness = lightMode
                ? Math.max(40, Math.min(60, hsl.l))
                : Math.max(50, Math.min(65, hsl.l));
            return hslToHex(hsl.h, mutedSaturation, mutedLightness);
        }
    });
}

/**
 * Generates a high-lightness bright palette with punchy colors
 * Creates energetic themes with elevated brightness levels
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 bright ANSI colors
 */
function generateBrightPalette(dominantColors, lightMode) {
    const palette = generateChromaticPalette(dominantColors, lightMode);

    // Increase lightness for all colors to create bright, cheerful tones
    return palette.map((color, index) => {
        const hsl = getColorHSL(color);

        if (index === 0) {
            // Background: very bright or very dark for contrast
            return lightMode ? hslToHex(hsl.h, 6, 98) : hslToHex(hsl.h, 10, 6);
        } else if (index === 7 || index === 15) {
            // Foreground: maintain contrast
            return lightMode ? hslToHex(hsl.h, 12, 15) : hslToHex(hsl.h, 8, 98);
        } else if (index === 8) {
            // Comment gray: bright but distinguishable
            return lightMode
                ? hslToHex(hsl.h, 15, 55)
                : hslToHex(hsl.h, 12, 65);
        } else {
            // ANSI colors: elevated lightness with good saturation
            const brightSaturation = Math.max(45, Math.min(70, hsl.s));
            const brightLightness = lightMode
                ? Math.max(45, Math.min(65, hsl.l + 10))
                : Math.max(65, Math.min(80, hsl.l + 15));
            return hslToHex(hsl.h, brightSaturation, brightLightness);
        }
    });
}

/**
 * Generates a Material Design-inspired palette
 * Uses actual image colors with Material's clean backgrounds and subtle refinement
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 Material Design ANSI colors
 */
function generateMaterialPalette(dominantColors, lightMode) {
    // Material Design emphasizes clean neutral backgrounds and high contrast
    // Use actual image colors but with Material's characteristic backgrounds

    const palette = new Array(ANSI_PALETTE_SIZE);
    const usedIndices = new Set();

    // Material backgrounds: clean, neutral, high contrast
    if (lightMode) {
        palette[0] = '#fafafa'; // Material Grey 50
        palette[7] = '#212121'; // Material Grey 900
    } else {
        palette[0] = '#121212'; // Material Dark background
        palette[7] = '#ffffff'; // Pure white
    }

    // Find best ANSI color matches from the actual image colors
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const matchIndex = findBestColorMatch(
            ANSI_HUE_ARRAY[i],
            dominantColors,
            usedIndices
        );
        const matchedColor = dominantColors[matchIndex];
        const hsl = getColorHSL(matchedColor);

        // Apply subtle Material Design refinement:
        // - Ensure minimum saturation for chromatic colors (prevent washed out)
        // - Normalize lightness for better contrast and readability
        const refinedSaturation = Math.max(hsl.s, 35);
        const refinedLightness = lightMode
            ? Math.max(35, Math.min(60, hsl.l)) // Light mode: not too dark, not too bright
            : Math.max(45, Math.min(70, hsl.l)); // Dark mode: slightly brighter

        palette[i + 1] = hslToHex(hsl.h, refinedSaturation, refinedLightness);
        usedIndices.add(matchIndex);
    }

    // Color 8 (bright black / comment): Material Grey
    palette[8] = lightMode ? '#757575' : '#9e9e9e';

    // Colors 9-14: Brighter versions of 1-6 with slight saturation boost
    for (let i = 1; i <= 6; i++) {
        const hsl = getColorHSL(palette[i]);
        const brightSaturation = Math.min(100, hsl.s + 8);
        const brightLightness = lightMode
            ? Math.max(30, hsl.l - 8) // Darker in light mode
            : Math.min(75, hsl.l + 8); // Brighter in dark mode

        palette[i + 8] = hslToHex(hsl.h, brightSaturation, brightLightness);
    }

    // Color 15 (bright white / bright foreground)
    palette[15] = lightMode ? '#000000' : '#ffffff';

    return palette;
}

/**
 * Generates an analogous color palette (adjacent hues on the color wheel)
 * Creates harmonious colors using hues close to the dominant color
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 analogous ANSI colors
 */
function generateAnalogousPalette(dominantColors, lightMode) {
    // Find the most saturated color to use as the base hue
    const chromaticColors = dominantColors
        .map(color => {
            const hsl = getColorHSL(color);
            return {color, hsl, saturation: hsl.s};
        })
        .filter(c => c.saturation > MONOCHROME_SATURATION_THRESHOLD)
        .sort((a, b) => b.saturation - a.saturation);

    // Use the most saturated color as the base, or fall back to the most common
    const baseColor =
        chromaticColors.length > 0
            ? chromaticColors[0]
            : {color: dominantColors[0], hsl: getColorHSL(dominantColors[0])};

    const baseHue = baseColor.hsl.h;

    // Sort all colors by lightness for background/foreground
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground using base hue
    if (lightMode) {
        palette[0] = hslToHex(baseHue, 12, Math.max(90, lightest.lightness));
        palette[7] = hslToHex(
            baseHue,
            30,
            Math.min(25, darkest.lightness + 10)
        );
    } else {
        palette[0] = hslToHex(baseHue, 18, Math.min(12, darkest.lightness));
        palette[7] = hslToHex(
            baseHue,
            15,
            Math.max(85, lightest.lightness - 10)
        );
    }

    // Generate ANSI colors 1-6 with analogous hues (±30 degrees)
    // Analogous colors are within 30 degrees on either side of the base hue
    const analogousOffsets = [-30, -20, -10, 10, 20, 30];
    const saturationLevels = [45, 50, 48, 52, 47, 50];
    const lightnessBase = lightMode ? 45 : 58;

    for (let i = 0; i < 6; i++) {
        const hue = (baseHue + analogousOffsets[i] + 360) % 360;
        const lightness = lightnessBase + (i % 2 === 0 ? -3 : 3);
        palette[i + 1] = hslToHex(hue, saturationLevels[i], lightness);
    }

    // Color 8 (bright black / comment color)
    palette[8] = lightMode
        ? hslToHex(baseHue, 20, 55)
        : hslToHex(baseHue, 15, 45);

    // Colors 9-14: Brighter versions with analogous hues
    for (let i = 0; i < 6; i++) {
        const hue = (baseHue + analogousOffsets[i] + 360) % 360;
        const lightness = lightMode ? 38 : 68;
        palette[i + 9] = hslToHex(hue, saturationLevels[i] + 8, lightness);
    }

    // Color 15 (bright white / foreground)
    palette[15] = lightMode
        ? hslToHex(baseHue, 20, 20)
        : hslToHex(baseHue, 10, 95);

    return palette;
}

/**
 * Adjusts a single color for dark background
 * @param {string[]} palette - Color palette
 * @param {Object} colorInfo - Color information
 * @private
 */
function adjustColorForDarkBackground(palette, colorInfo) {
    if (colorInfo.lightness >= MIN_LIGHTNESS_ON_DARK_BG) {
        return;
    }

    const adjustedLightness = MIN_LIGHTNESS_ON_DARK_BG + colorInfo.index * 3;
    console.log(
        `Adjusting color ${colorInfo.index} for dark background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
    );

    palette[colorInfo.index] = adjustColorLightness(
        palette[colorInfo.index],
        adjustedLightness
    );

    if (colorInfo.index >= 1 && colorInfo.index <= 6) {
        palette[colorInfo.index + 8] = generateBrightVersion(
            palette[colorInfo.index]
        );
    }
}

/**
 * Adjusts a single color for light background
 * @param {string[]} palette - Color palette
 * @param {Object} colorInfo - Color information
 * @private
 */
function adjustColorForLightBackground(palette, colorInfo) {
    if (colorInfo.lightness <= MAX_LIGHTNESS_ON_LIGHT_BG) {
        return;
    }

    const adjustedLightness = Math.max(
        ABSOLUTE_MIN_LIGHTNESS,
        MAX_LIGHTNESS_ON_LIGHT_BG - colorInfo.index * 2
    );
    console.log(
        `Adjusting color ${colorInfo.index} for light background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
    );

    palette[colorInfo.index] = adjustColorLightness(
        palette[colorInfo.index],
        adjustedLightness
    );

    if (colorInfo.index >= 1 && colorInfo.index <= 6) {
        palette[colorInfo.index + 8] = generateBrightVersion(
            palette[colorInfo.index]
        );
    }
}

/**
 * Adjusts outlier color for normal background
 * @param {string[]} palette - Color palette
 * @param {Object} outlier - Outlier color information
 * @param {number} avgLightness - Average lightness
 * @param {boolean} isBrightTheme - Whether theme is bright
 * @private
 */
function adjustOutlierColor(palette, outlier, avgLightness, isBrightTheme) {
    const isDarkOutlierInBrightTheme =
        isBrightTheme &&
        outlier.lightness < avgLightness - OUTLIER_LIGHTNESS_THRESHOLD;

    const isBrightOutlierInDarkTheme =
        !isBrightTheme &&
        outlier.lightness > avgLightness + OUTLIER_LIGHTNESS_THRESHOLD;

    if (!isDarkOutlierInBrightTheme && !isBrightOutlierInDarkTheme) {
        return;
    }

    const adjustedLightness = isDarkOutlierInBrightTheme
        ? avgLightness - 10
        : avgLightness + 10;

    const outlierType = isDarkOutlierInBrightTheme ? 'dark' : 'bright';
    console.log(
        `Adjusting ${outlierType} outlier color ${outlier.index}: ${outlier.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
    );

    palette[outlier.index] = adjustColorLightness(
        palette[outlier.index],
        adjustedLightness
    );

    if (outlier.index >= 1 && outlier.index <= 6) {
        palette[outlier.index + 8] = generateBrightVersion(
            palette[outlier.index]
        );
    }
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

    const avgLightness =
        ansiColors.reduce((sum, c) => sum + c.lightness, 0) / ansiColors.length;
    const isBrightTheme = avgLightness > BRIGHT_THEME_THRESHOLD;

    if (isVeryDarkBg) {
        ansiColors.forEach(colorInfo =>
            adjustColorForDarkBackground(palette, colorInfo)
        );
        return palette;
    }

    if (isVeryLightBg) {
        ansiColors.forEach(colorInfo =>
            adjustColorForLightBackground(palette, colorInfo)
        );
        return palette;
    }

    // Normal background - apply outlier detection
    const outliers = ansiColors.filter(
        c => Math.abs(c.lightness - avgLightness) > OUTLIER_LIGHTNESS_THRESHOLD
    );

    outliers.forEach(outlier =>
        adjustOutlierColor(palette, outlier, avgLightness, isBrightTheme)
    );

    return palette;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extracts colors from wallpaper using native GdkPixbuf and generates ANSI palette
 * Uses median-cut algorithm for color quantization - no external dependencies required
 * Includes caching to avoid re-processing the same image
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @param {string} [extractionMode='normal'] - Extraction mode: 'normal' (auto-detect), 'monochromatic', 'analogous', 'pastel', 'material'
 * @returns {Promise<string[]>} Array of 16 ANSI colors
 */
export async function extractColorsWithImageMagick(
    imagePath,
    lightMode = false,
    extractionMode = 'normal'
) {
    try {
        // Check cache first (include extraction mode in cache key)
        const cacheKey =
            extractionMode !== 'normal'
                ? `${getCacheKey(imagePath, lightMode)}_${extractionMode}`
                : getCacheKey(imagePath, lightMode);
        if (cacheKey) {
            const cachedPalette = loadCachedPalette(cacheKey);
            if (cachedPalette) {
                return cachedPalette;
            }
        }

        // Extract dominant colors
        const dominantColors = await extractDominantColors(
            imagePath,
            DOMINANT_COLORS_TO_EXTRACT
        );

        if (dominantColors.length < 8) {
            throw new Error('Not enough colors extracted from image');
        }

        let palette;

        // Generate palette based on extraction mode
        switch (extractionMode) {
            case 'monochromatic':
                console.log(
                    'Monochromatic mode - generating single-hue palette from dominant color'
                );
                palette = generateMonochromaticPalette(
                    dominantColors,
                    lightMode
                );
                break;
            case 'analogous':
                console.log(
                    'Analogous mode - generating harmonious adjacent hues'
                );
                palette = generateAnalogousPalette(dominantColors, lightMode);
                break;
            case 'pastel':
                console.log('Pastel mode - generating soft, muted palette');
                palette = generatePastelPalette(dominantColors, lightMode);
                break;
            case 'material':
                console.log(
                    'Material mode - using image colors with Material Design backgrounds'
                );
                palette = generateMaterialPalette(dominantColors, lightMode);
                break;
            case 'colorful':
                console.log(
                    'Colorful mode - generating vibrant, highly saturated palette'
                );
                palette = generateColorfulPalette(dominantColors, lightMode);
                break;
            case 'muted':
                console.log(
                    'Muted mode - generating desaturated, calm palette'
                );
                palette = generateMutedPalette(dominantColors, lightMode);
                break;
            case 'bright':
                console.log(
                    'Bright mode - generating high-lightness, energetic palette'
                );
                palette = generateBrightPalette(dominantColors, lightMode);
                break;
            case 'normal':
            default:
                // Auto-detect image type and generate appropriate palette
                if (isMonochromeImage(dominantColors)) {
                    console.log(
                        'Detected monochrome/grayscale image - generating grayscale palette'
                    );
                    palette = generateMonochromePalette(
                        dominantColors,
                        lightMode
                    );
                } else if (hasLowColorDiversity(dominantColors)) {
                    console.log(
                        'Detected low color diversity - generating subtle balanced palette'
                    );
                    palette = generateSubtleBalancedPalette(
                        dominantColors,
                        lightMode
                    );
                } else {
                    console.log(
                        'Detected diverse chromatic image - generating vibrant colorful palette'
                    );
                    palette = generateChromaticPalette(
                        dominantColors,
                        lightMode
                    );
                }
                break;
        }

        // Normalize brightness for readability
        palette = normalizeBrightness(palette);

        // Save to cache
        if (cacheKey) {
            savePaletteToCache(cacheKey, palette);
        }

        return palette;
    } catch (e) {
        throw new Error(`Color extraction failed: ${e.message}`);
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

    const foreground = findForegroundColor(
        dominantColors,
        lightMode,
        usedIndices
    );
    usedIndices.add(foreground.index);

    const palette = new Array(ANSI_PALETTE_SIZE);
    palette[0] = background.color;
    palette[7] = foreground.color;

    // Find best matches for ANSI colors 1-6
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const matchIndex = findBestColorMatch(
            ANSI_HUE_ARRAY[i],
            dominantColors,
            usedIndices
        );
        palette[i + 1] = dominantColors[matchIndex];
        usedIndices.add(matchIndex);
    }

    // Generate color8 (bright black/gray) - brighter in dark mode, darker in light mode
    const bgHsl = getColorHSL(background.color);
    const color8Lightness = isDarkColor(background.color)
        ? Math.min(100, bgHsl.l + 45)
        : Math.max(0, bgHsl.l - 40);
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
 * @param {string} [extractionMode='normal'] - Extraction mode
 */
export function extractColorsFromWallpaperIM(
    imagePath,
    lightMode,
    onSuccess,
    onError,
    extractionMode = 'normal'
) {
    extractColorsWithImageMagick(imagePath, lightMode, extractionMode)
        .then(colors => onSuccess(colors))
        .catch(error => onError(error));
}
