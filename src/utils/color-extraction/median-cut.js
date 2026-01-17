import GdkPixbuf from 'gi://GdkPixbuf';
import {rgbToHex} from '../color-utils.js';
import {
    IMAGE_SCALE_SIZE,
    MIN_PIXELS_TO_SAMPLE,
    MAX_PIXELS_TO_SAMPLE,
} from './constants.js';

/**
 * Median-cut color quantization algorithm
 * Extracts dominant colors from images using GdkPixbuf
 *
 * @module color-extraction/median-cut
 */

/**
 * Loads an image and extracts pixel data using GdkPixbuf
 * Scales large images down to IMAGE_SCALE_SIZE for faster processing
 *
 * @param {string} imagePath - Path to the image file
 * @returns {{pixels: Uint8Array, width: number, height: number, channels: number, rowstride: number}}
 */
export function loadImagePixels(imagePath) {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
        imagePath,
        IMAGE_SCALE_SIZE,
        IMAGE_SCALE_SIZE,
        true
    );

    return {
        pixels: pixbuf.get_pixels(),
        width: pixbuf.get_width(),
        height: pixbuf.get_height(),
        channels: pixbuf.get_n_channels(),
        rowstride: pixbuf.get_rowstride(),
    };
}

/**
 * Samples pixels from image data and returns RGB color array
 * Skips transparent pixels and samples at a rate based on image size
 *
 * @param {Object} imageData - Image data from loadImagePixels
 * @returns {Array<{r: number, g: number, b: number}>} Array of RGB colors
 */
export function samplePixels(imageData) {
    const {pixels, width, height, channels, rowstride} = imageData;
    const colors = [];
    const hasAlpha = channels === 4;
    const sampleRate = Math.max(
        1,
        Math.floor((width * height) / MAX_PIXELS_TO_SAMPLE)
    );

    for (let y = 0; y < height; y += sampleRate) {
        for (let x = 0; x < width; x += sampleRate) {
            const offset = y * rowstride + x * channels;

            // Skip transparent pixels
            if (hasAlpha && pixels[offset + 3] < 128) {
                continue;
            }

            colors.push({
                r: pixels[offset],
                g: pixels[offset + 1],
                b: pixels[offset + 2],
            });
        }
    }

    return colors;
}

/**
 * Represents a color bucket for median-cut algorithm
 * Contains a set of colors and methods to split the bucket
 */
export class ColorBucket {
    /**
     * @param {Array<{r: number, g: number, b: number}>} colors - Colors in this bucket
     */
    constructor(colors) {
        this.colors = colors;
        this._computeRanges();
    }

    /**
     * Computes min/max ranges for each color channel
     * @private
     */
    _computeRanges() {
        if (this.colors.length === 0) {
            this.ranges = {
                r: {min: 0, max: 0},
                g: {min: 0, max: 0},
                b: {min: 0, max: 0},
            };
            return;
        }

        const first = this.colors[0];
        this.ranges = {
            r: {min: first.r, max: first.r},
            g: {min: first.g, max: first.g},
            b: {min: first.b, max: first.b},
        };

        for (const color of this.colors) {
            for (const channel of ['r', 'g', 'b']) {
                this.ranges[channel].min = Math.min(
                    this.ranges[channel].min,
                    color[channel]
                );
                this.ranges[channel].max = Math.max(
                    this.ranges[channel].max,
                    color[channel]
                );
            }
        }
    }

    /**
     * Gets the range (max - min) for a specific channel
     * @param {'r'|'g'|'b'} channel
     * @returns {number}
     * @private
     */
    _getRange(channel) {
        return this.ranges[channel].max - this.ranges[channel].min;
    }

    /**
     * Returns the channel with the widest range
     * Used to determine which axis to split on
     * @returns {'r'|'g'|'b'}
     */
    getLongestChannel() {
        const rRange = this._getRange('r');
        const gRange = this._getRange('g');
        const bRange = this._getRange('b');

        if (rRange >= gRange && rRange >= bRange) return 'r';
        if (gRange >= bRange) return 'g';
        return 'b';
    }

    /**
     * Splits bucket along the longest channel at the median
     * @returns {[ColorBucket, ColorBucket]}
     */
    split() {
        const channel = this.getLongestChannel();
        this.colors.sort((a, b) => a[channel] - b[channel]);

        const midpoint = Math.floor(this.colors.length / 2);
        return [
            new ColorBucket(this.colors.slice(0, midpoint)),
            new ColorBucket(this.colors.slice(midpoint)),
        ];
    }

    /**
     * Returns the average color of this bucket
     * @returns {{r: number, g: number, b: number, count: number}}
     */
    getAverageColor() {
        const count = this.colors.length;
        if (count === 0) {
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

        return {
            r: Math.round(rSum / count),
            g: Math.round(gSum / count),
            b: Math.round(bSum / count),
            count,
        };
    }

    /**
     * Returns the volume of this bucket (for priority queue)
     * Larger volume = more color variation = higher split priority
     * @returns {number}
     */
    getVolume() {
        return (
            this._getRange('r') *
            this._getRange('g') *
            this._getRange('b') *
            this.colors.length
        );
    }
}

/**
 * Deduplicates colors and returns unique entries with count
 * @param {Array<{r: number, g: number, b: number}>} colors - Array of RGB colors
 * @returns {Array<{r: number, g: number, b: number, count: number}>} Unique colors
 */
function deduplicateColors(colors) {
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

/**
 * Finds the bucket with largest volume that can be split
 * @param {ColorBucket[]} buckets - Array of color buckets
 * @returns {number} Index of bucket to split, or -1 if none available
 */
function findLargestSplittableBucket(buckets) {
    let maxVolume = 0;
    let maxIndex = -1;

    for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        if (bucket.colors.length > 1) {
            const volume = bucket.getVolume();
            if (volume > maxVolume) {
                maxVolume = volume;
                maxIndex = i;
            }
        }
    }

    return maxIndex;
}

/**
 * Implements median-cut color quantization algorithm
 * Recursively splits color space to find representative colors
 *
 * @param {Array<{r: number, g: number, b: number}>} colors - Array of RGB colors
 * @param {number} numColors - Target number of colors
 * @returns {Array<{r: number, g: number, b: number, count: number}>} Quantized colors
 */
export function medianCut(colors, numColors) {
    if (colors.length === 0) {
        return [];
    }

    if (colors.length <= numColors) {
        return deduplicateColors(colors);
    }

    const buckets = [new ColorBucket(colors)];

    while (buckets.length < numColors) {
        const splitIndex = findLargestSplittableBucket(buckets);
        if (splitIndex === -1) break;

        const [left, right] = buckets[splitIndex].split();
        buckets.splice(splitIndex, 1, left, right);
    }

    return buckets
        .map(bucket => bucket.getAverageColor())
        .filter(c => c.count > 0);
}

/**
 * Extracts the N most dominant colors from an image using GdkPixbuf
 * Uses median-cut algorithm for color quantization
 *
 * @param {string} imagePath - Path to the image file
 * @param {number} numColors - Number of colors to extract
 * @returns {Promise<string[]>} Array of hex colors sorted by dominance
 */
export async function extractDominantColors(imagePath, numColors) {
    const imageData = loadImagePixels(imagePath);
    const pixels = samplePixels(imageData);

    if (pixels.length < MIN_PIXELS_TO_SAMPLE / 10) {
        throw new Error('Not enough pixels to extract colors');
    }

    const quantizedColors = medianCut(pixels, numColors);

    if (quantizedColors.length === 0) {
        throw new Error('No colors extracted from image');
    }

    // Sort by count (dominance)
    quantizedColors.sort((a, b) => b.count - a.count);

    return quantizedColors.map(c => rgbToHex(c.r, c.g, c.b).toUpperCase());
}
