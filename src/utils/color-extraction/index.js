/**
 * Color extraction module
 * Extracts dominant colors from images and generates ANSI palettes
 *
 * @module color-extraction
 */

import {DOMINANT_COLORS_TO_EXTRACT} from './constants.js';
import {getCacheKey, loadCachedPalette, savePaletteToCache} from './cache.js';
import {extractDominantColors} from './median-cut.js';
import {isMonochromeImage, hasLowColorDiversity} from './color-analysis.js';
import {
    generateChromaticPalette,
    generateSubtleBalancedPalette,
    generateMonochromePalette,
    generateMonochromaticPalette,
    generatePastelPalette,
    generateColorfulPalette,
    generateMutedPalette,
    generateBrightPalette,
    generateMaterialPalette,
    generateAnalogousPalette,
    normalizeBrightness,
} from './palette-generators.js';
import {createLogger} from '../logger.js';

const log = createLogger('ColorExtraction');

// Re-export submodules for direct access if needed
export * from './constants.js';
export * from './cache.js';
export * from './median-cut.js';
export * from './color-analysis.js';
export * from './palette-generators.js';

/**
 * Extracts colors from wallpaper using native GdkPixbuf and generates ANSI palette
 * Uses median-cut algorithm for color quantization - no external dependencies required
 * Includes caching to avoid re-processing the same image
 *
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @param {string} [extractionMode='normal'] - Extraction mode: 'normal' (auto-detect), 'monochromatic', 'analogous', 'pastel', 'material', 'colorful', 'muted', 'bright'
 * @returns {Promise<string[]>} Array of 16 ANSI colors
 */
export async function extractColorsWithImageMagick(
    imagePath,
    lightMode = false,
    extractionMode = 'normal'
) {
    try {
        // Check cache first
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

        // Extraction mode generators with descriptions
        const modeGenerators = {
            monochromatic: {
                fn: generateMonochromaticPalette,
                desc: 'Monochromatic mode - generating single-hue palette',
            },
            analogous: {
                fn: generateAnalogousPalette,
                desc: 'Analogous mode - generating harmonious adjacent hues',
            },
            pastel: {
                fn: generatePastelPalette,
                desc: 'Pastel mode - generating soft, muted palette',
            },
            material: {
                fn: generateMaterialPalette,
                desc: 'Material mode - using Material Design backgrounds',
            },
            colorful: {
                fn: generateColorfulPalette,
                desc: 'Colorful mode - generating vibrant palette',
            },
            muted: {
                fn: generateMutedPalette,
                desc: 'Muted mode - generating desaturated palette',
            },
            bright: {
                fn: generateBrightPalette,
                desc: 'Bright mode - generating high-lightness palette',
            },
        };

        let palette;
        const generator = modeGenerators[extractionMode];

        if (generator) {
            log.info(generator.desc);
            palette = generator.fn(dominantColors, lightMode);
        } else {
            // Auto-detect image type for 'normal' mode
            if (isMonochromeImage(dominantColors)) {
                log.info(
                    'Detected monochrome image - generating grayscale palette'
                );
                palette = generateMonochromePalette(dominantColors, lightMode);
            } else if (hasLowColorDiversity(dominantColors)) {
                log.info('Detected low diversity - generating subtle palette');
                palette = generateSubtleBalancedPalette(
                    dominantColors,
                    lightMode
                );
            } else {
                log.info(
                    'Detected diverse image - generating chromatic palette'
                );
                palette = generateChromaticPalette(dominantColors, lightMode);
            }
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
