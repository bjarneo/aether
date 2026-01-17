/**
 * ui-constants.js - Centralized UI constants for Aether
 *
 * This file contains all UI-related magic numbers and configuration values.
 * Using constants instead of hardcoded values improves:
 * - Maintainability: Change once, update everywhere
 * - Readability: Self-documenting code
 * - Consistency: Same values across components
 *
 * @module ui-constants
 */

// ============================================================================
// SPACING & MARGINS
// ============================================================================

/**
 * Standard spacing values for consistent UI layout
 */
export const SPACING = {
    /** Extra small spacing (2px) - tight grouping */
    XS: 2,
    /** Small spacing (6px) - related elements */
    SM: 6,
    /** Medium spacing (12px) - standard gap */
    MD: 12,
    /** Large spacing (16px) - section separation */
    LG: 16,
    /** Extra large spacing (20px) - major sections */
    XL: 20,
    /** Extra extra large spacing (24px) - page sections */
    XXL: 24,
};

/**
 * Standard margin values
 */
export const MARGINS = {
    /** Small margin (6px) */
    SM: 6,
    /** Medium margin (12px) */
    MD: 12,
    /** Large margin (18px) */
    LG: 18,
    /** Extra large margin (24px) */
    XL: 24,
};

// ============================================================================
// GRID LAYOUT
// ============================================================================

/**
 * Grid configuration for FlowBox widgets
 */
export const GRID = {
    /** Minimum columns for wallpaper grids */
    MIN_COLUMNS: 2,
    /** Maximum columns for wallpaper grids */
    MAX_COLUMNS: 3,
    /** Default column spacing */
    COLUMN_SPACING: 12,
    /** Default row spacing */
    ROW_SPACING: 12,
};

/**
 * Wallpaper card dimensions
 */
export const WALLPAPER_CARD = {
    /** Thumbnail height in pixels */
    THUMBNAIL_HEIGHT: 180,
    /** Overlay icon size */
    ICON_SIZE: 24,
    /** Action button size */
    BUTTON_SIZE: 36,
};

// ============================================================================
// COMPONENT DIMENSIONS
// ============================================================================

/**
 * Slider control dimensions
 */
export const SLIDER = {
    /** Standard slider width */
    WIDTH: 200,
    /** Compact slider width */
    COMPACT_WIDTH: 150,
    /** Value label character width */
    VALUE_LABEL_CHARS: 7,
};

/**
 * Color swatch dimensions
 */
export const COLOR_SWATCH = {
    /** Standard swatch size */
    SIZE: 32,
    /** Large swatch size (for main palette) */
    LARGE_SIZE: 48,
    /** Small swatch size (for presets preview) */
    SMALL_SIZE: 20,
};

/**
 * Button dimensions
 */
export const BUTTON = {
    /** Tone picker button width */
    TONE_WIDTH: 52,
    /** Tone picker button height */
    TONE_HEIGHT: 36,
    /** Preset button height */
    PRESET_HEIGHT: 50,
    /** Icon button size */
    ICON_SIZE: 24,
};

/**
 * Dialog and window dimensions
 */
export const WINDOW = {
    /** Default window width */
    DEFAULT_WIDTH: 900,
    /** Default window height */
    DEFAULT_HEIGHT: 700,
    /** Maximum content clamp width */
    MAX_CONTENT_WIDTH: 800,
    /** Content tightening threshold */
    TIGHTENING_THRESHOLD: 600,
};

/**
 * Sidebar dimensions
 */
export const SIDEBAR = {
    /** Sidebar width fraction (0-1) */
    WIDTH_FRACTION: 0.3,
    /** Maximum sidebar width */
    MAX_WIDTH: 350,
    /** Scrolled list maximum height */
    SCROLLED_LIST_HEIGHT: 300,
};

// ============================================================================
// ANIMATION & TIMING
// ============================================================================

/**
 * Animation durations in milliseconds
 */
export const ANIMATION = {
    /** Fast transition (100ms) */
    FAST: 100,
    /** Standard transition (200ms) */
    STANDARD: 200,
    /** Slow transition (300ms) */
    SLOW: 300,
    /** Very slow transition (500ms) */
    VERY_SLOW: 500,
};

/**
 * Timing values in milliseconds
 */
export const TIMING = {
    /** Double-click detection window */
    DOUBLE_CLICK: 300,
    /** Debounce delay for input */
    DEBOUNCE: 75,
    /** Toast notification timeout (seconds) */
    TOAST_TIMEOUT: 2,
    /** Long toast timeout (seconds) */
    TOAST_TIMEOUT_LONG: 3,
    /** Confirmation dialog timeout (seconds) */
    CONFIRMATION_TIMEOUT: 60,
};

// ============================================================================
// WALLPAPER BROWSER
// ============================================================================

/**
 * Wallhaven API configuration
 */
export const WALLHAVEN = {
    /** Results per page */
    RESULTS_PER_PAGE: 24,
    /** Thumbnail cache directory name */
    THUMB_CACHE_DIR: 'wallhaven-thumbs',
    /** Wallpaper cache directory name */
    WALLPAPER_CACHE_DIR: 'wallhaven-wallpapers',
    /** Rate limit (requests per minute without API key) */
    RATE_LIMIT: 45,
};

/**
 * Local wallpaper browser configuration
 */
export const LOCAL_BROWSER = {
    /** Default wallpapers directory name */
    DIRECTORY: 'Wallpapers',
    /** Supported image extensions */
    EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
};

// ============================================================================
// COLOR EXTRACTION
// ============================================================================

/**
 * ImageMagick processing settings
 * (More detailed settings in extraction-constants.js)
 */
export const IMAGE_PROCESSING = {
    /** Maximum image scale for processing */
    MAX_SCALE: '800x600>',
    /** JPEG quality for preview */
    PREVIEW_QUALITY: 95,
    /** Processing bit depth */
    BIT_DEPTH: 8,
};

// ============================================================================
// THEME & STYLING
// ============================================================================

/**
 * Border radius values
 * Note: Aether uses 0 for sharp corners (Hyprland aesthetic)
 */
export const BORDER_RADIUS = {
    /** No rounding (Aether default) */
    NONE: 0,
    /** Small rounding */
    SM: 4,
    /** Medium rounding */
    MD: 8,
    /** Large rounding */
    LG: 12,
    /** Full rounding (pill shape) */
    FULL: 9999,
};

/**
 * Z-index layers (for CSS if needed)
 */
export const Z_INDEX = {
    BASE: 0,
    DROPDOWN: 100,
    OVERLAY: 200,
    MODAL: 300,
    TOAST: 400,
};

// ============================================================================
// PALETTE
// ============================================================================

/**
 * ANSI palette configuration
 */
export const PALETTE = {
    /** Number of colors in ANSI palette */
    SIZE: 16,
    /** Number of normal colors (0-7) */
    NORMAL_COUNT: 8,
    /** Number of bright colors (8-15) */
    BRIGHT_COUNT: 8,
};

/**
 * Color preset preview configuration
 */
export const PRESET_PREVIEW = {
    /** Number of colors to show in preview */
    COLOR_COUNT: 6,
    /** Preview swatch size */
    SWATCH_SIZE: 20,
};

// ============================================================================
// FILE LIMITS
// ============================================================================

/**
 * File size and count limits
 */
export const LIMITS = {
    /** Maximum wallpapers to display per page */
    MAX_WALLPAPERS_PER_PAGE: 50,
    /** Maximum blueprints to display */
    MAX_BLUEPRINTS: 100,
    /** Maximum favorites */
    MAX_FAVORITES: 200,
    /** Maximum additional images */
    MAX_ADDITIONAL_IMAGES: 10,
};

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Creates standard margin configuration object for GTK widgets
 * @param {number} vertical - Top and bottom margin
 * @param {number} [horizontal] - Start and end margin (defaults to vertical)
 * @returns {Object} Margin configuration object
 */
export function createMarginConfig(vertical, horizontal = null) {
    const h = horizontal ?? vertical;
    return {
        margin_top: vertical,
        margin_bottom: vertical,
        margin_start: h,
        margin_end: h,
    };
}

/**
 * Creates standard spacing configuration for a box
 * @param {number} spacing - Spacing between children
 * @param {number} [margin] - Margin around the box
 * @returns {Object} Spacing configuration object
 */
export function createSpacingConfig(spacing, margin = 0) {
    return {
        spacing,
        ...createMarginConfig(margin),
    };
}
