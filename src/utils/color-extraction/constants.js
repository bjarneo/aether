/**
 * Color extraction constants
 * Centralized configuration for color extraction algorithm
 *
 * @module color-extraction/constants
 */

// ============================================================================
// PALETTE CONFIGURATION
// ============================================================================

/** Number of ANSI colors in a complete palette */
export const ANSI_PALETTE_SIZE = 16;

/** Number of dominant colors to extract from image for analysis */
export const DOMINANT_COLORS_TO_EXTRACT = 32;

/** Cache version number - increment when cache format changes */
export const CACHE_VERSION = 1;

// ============================================================================
// COLOR DETECTION THRESHOLDS
// ============================================================================

/** Saturation threshold below which a color is considered grayscale (0-100) */
export const MONOCHROME_SATURATION_THRESHOLD = 15;

/** Percentage of low-saturation colors needed to classify image as monochrome (0-1) */
export const MONOCHROME_IMAGE_THRESHOLD = 0.7;

/** Percentage of similar color pairs needed to classify as low diversity (0-1) */
export const LOW_DIVERSITY_THRESHOLD = 0.6;

/** Hue difference (degrees) within which colors are considered similar (0-360) */
export const SIMILAR_HUE_RANGE = 30;

/** Lightness difference (%) within which colors are considered similar (0-100) */
export const SIMILAR_LIGHTNESS_RANGE = 20;

// ============================================================================
// COLOR QUALITY PREFERENCES
// ============================================================================

/** Minimum saturation for chromatic ANSI colors (0-100) */
export const MIN_CHROMATIC_SATURATION = 15;

/** Ideal saturation range for vibrant colors - lower bound (0-100) */
export const IDEAL_SATURATION_MIN = 30;

/** Ideal saturation range for vibrant colors - upper bound (0-100) */
export const IDEAL_SATURATION_MAX = 100;

/** Ideal lightness range for readable colors - lower bound (0-100) */
export const IDEAL_LIGHTNESS_MIN = 30;

/** Ideal lightness range for readable colors - upper bound (0-100) */
export const IDEAL_LIGHTNESS_MAX = 80;

/** Lightness below which a color is considered too dark (0-100) */
export const TOO_DARK_THRESHOLD = 20;

/** Lightness above which a color is considered too bright (0-100) */
export const TOO_BRIGHT_THRESHOLD = 85;

// ============================================================================
// BRIGHTNESS NORMALIZATION
// ============================================================================

/** Lightness below which background is considered very dark (0-100) */
export const VERY_DARK_BACKGROUND_THRESHOLD = 20;

/** Lightness above which background is considered very light (0-100) */
export const VERY_LIGHT_BACKGROUND_THRESHOLD = 80;

/** Minimum lightness for colors on very dark backgrounds (0-100) */
export const MIN_LIGHTNESS_ON_DARK_BG = 55;

/** Maximum lightness for colors on very light backgrounds (0-100) */
export const MAX_LIGHTNESS_ON_LIGHT_BG = 45;

/** Absolute minimum lightness to prevent invisible colors (0-100) */
export const ABSOLUTE_MIN_LIGHTNESS = 25;

/** Lightness difference threshold for outlier detection (0-100) */
export const OUTLIER_LIGHTNESS_THRESHOLD = 25;

/** Lightness threshold to determine if theme is bright vs dark (0-100) */
export const BRIGHT_THEME_THRESHOLD = 50;

/** Lightness threshold to determine if a color is dark (0-100) */
export const DARK_COLOR_THRESHOLD = 50;

// ============================================================================
// PALETTE GENERATION SETTINGS
// ============================================================================

/** Base saturation for subtle balanced palettes (0-100) */
export const SUBTLE_PALETTE_SATURATION = 28;

/** Saturation for monochrome palette colors (0-100) */
export const MONOCHROME_SATURATION = 5;

/** Saturation multiplier for color8 in monochrome (0-1) */
export const MONOCHROME_COLOR8_SATURATION_FACTOR = 0.5;

/** Lightness increase for bright ANSI colors (9-14) */
export const BRIGHT_COLOR_LIGHTNESS_BOOST = 18;

/** Saturation multiplier for bright ANSI colors (9-14) */
export const BRIGHT_COLOR_SATURATION_BOOST = 1.1;

// ============================================================================
// STANDARD ANSI COLOR HUES
// ============================================================================

/** ANSI color hue targets for proper color mapping */
export const ANSI_COLOR_HUES = {
    RED: 0,
    GREEN: 120,
    YELLOW: 60,
    BLUE: 240,
    MAGENTA: 300,
    CYAN: 180,
};

/** Ordered array of ANSI hue targets for colors 1-6 */
export const ANSI_HUE_ARRAY = [
    ANSI_COLOR_HUES.RED, // color1
    ANSI_COLOR_HUES.GREEN, // color2
    ANSI_COLOR_HUES.YELLOW, // color3
    ANSI_COLOR_HUES.BLUE, // color4
    ANSI_COLOR_HUES.MAGENTA, // color5
    ANSI_COLOR_HUES.CYAN, // color6
];

// ============================================================================
// IMAGE PROCESSING SETTINGS
// ============================================================================

/** Maximum image dimension for fast processing (pixels) */
export const IMAGE_SCALE_SIZE = 200;

/** Minimum pixels to sample for reliable color extraction */
export const MIN_PIXELS_TO_SAMPLE = 1000;

/** Maximum pixels to sample (for very large images) */
export const MAX_PIXELS_TO_SAMPLE = 40000;
