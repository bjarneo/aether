/**
 * Color extraction module - re-exports from modular structure
 *
 * This file maintains backwards compatibility by re-exporting the main functions
 * from the new modular color-extraction/ directory.
 *
 * The implementation has been split into focused modules:
 * - color-extraction/constants.js - Configuration constants
 * - color-extraction/cache.js - Palette caching
 * - color-extraction/median-cut.js - Color quantization algorithm
 * - color-extraction/color-analysis.js - Color analysis utilities
 * - color-extraction/palette-generators.js - Palette generation functions
 * - color-extraction/index.js - Main entry point
 *
 * @module color-extraction
 */

export {
    extractColorsWithImageMagick,
    extractColorsFromWallpaperIM,
} from './color-extraction/index.js';
