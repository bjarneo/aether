/**
 * Color-related constants and default values
 */

// ANSI color role definitions with semantic names
export const ANSI_COLOR_ROLES = [
    {
        id: 'background',
        label: 'Background',
        description: 'Primary background color',
    },
    {id: 'foreground', label: 'Foreground', description: 'Primary text color'},
    {id: 'black', label: 'Black', description: 'Normal black (ANSI 0)'},
    {id: 'red', label: 'Red', description: 'Normal red (ANSI 1)'},
    {id: 'green', label: 'Green', description: 'Normal green (ANSI 2)'},
    {id: 'yellow', label: 'Yellow', description: 'Normal yellow (ANSI 3)'},
    {id: 'blue', label: 'Blue', description: 'Normal blue (ANSI 4)'},
    {id: 'magenta', label: 'Magenta', description: 'Normal magenta (ANSI 5)'},
    {id: 'cyan', label: 'Cyan', description: 'Normal cyan (ANSI 6)'},
    {id: 'white', label: 'White', description: 'Normal white (ANSI 7)'},
    {id: 'bright_black', label: 'Bright Black', description: 'Bright black (ANSI 8)'},
    {id: 'bright_red', label: 'Bright Red', description: 'Bright red (ANSI 9)'},
    {id: 'bright_green', label: 'Bright Green', description: 'Bright green (ANSI 10)'},
    {id: 'bright_yellow', label: 'Bright Yellow', description: 'Bright yellow (ANSI 11)'},
    {id: 'bright_blue', label: 'Bright Blue', description: 'Bright blue (ANSI 12)'},
    {id: 'bright_magenta', label: 'Bright Magenta', description: 'Bright magenta (ANSI 13)'},
    {id: 'bright_cyan', label: 'Bright Cyan', description: 'Bright cyan (ANSI 14)'},
    {id: 'bright_white', label: 'Bright White', description: 'Bright white (ANSI 15)'},
];

// Map semantic names to color0-15 for backwards compatibility
export const COLOR_NAME_TO_INDEX = {
    black: 'color0',
    red: 'color1',
    green: 'color2',
    yellow: 'color3',
    blue: 'color4',
    magenta: 'color5',
    cyan: 'color6',
    white: 'color7',
    bright_black: 'color8',
    bright_red: 'color9',
    bright_green: 'color10',
    bright_yellow: 'color11',
    bright_blue: 'color12',
    bright_magenta: 'color13',
    bright_cyan: 'color14',
    bright_white: 'color15',
};

// Default color scheme (Catppuccin-inspired)
// Uses semantic names (black, red, etc.) as primary keys
export const DEFAULT_COLORS = {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#cba6f7',
    cyan: '#94e2d5',
    white: '#bac2de',
    bright_black: '#585b70',
    bright_red: '#f38ba8',
    bright_green: '#a6e3a1',
    bright_yellow: '#f9e2af',
    bright_blue: '#89b4fa',
    bright_magenta: '#cba6f7',
    bright_cyan: '#94e2d5',
    bright_white: '#cdd6f4',
};

// ANSI color names for tooltips with descriptions
export const ANSI_COLOR_NAMES = [
    'Black (0) - Normal black, used for dark text and backgrounds',
    'Red (1) - Normal red, used for errors and warnings',
    'Green (2) - Normal green, used for success messages and confirmations',
    'Yellow (3) - Normal yellow, used for warnings and highlights',
    'Blue (4) - Normal blue, used for information and links',
    'Magenta (5) - Normal magenta, used for special elements and constants',
    'Cyan (6) - Normal cyan, used for strings and secondary information',
    'White (7) - Normal white, used for regular text',
    'Bright Black (8) - Comments and dimmed text',
    'Bright Red (9) - Intense errors and critical warnings',
    'Bright Green (10) - Emphasized success and completions',
    'Bright Yellow (11) - Important warnings and search highlights',
    'Bright Blue (12) - Emphasized information and active links',
    'Bright Magenta (13) - Special keywords and focused elements',
    'Bright Cyan (14) - Highlighted strings and important data',
    'Bright White (15) - Bold text and headings',
];

// Color harmony types
export const HARMONY_TYPES = [
    'Analogous',
    'Monochromatic',
    'Complementary',
    'Split Complementary',
    'Shades',
    'Squares',
];

// Color adjustment limits
export const ADJUSTMENT_LIMITS = {
    vibrance: {min: -50, max: 50, step: 5, default: 0},
    contrast: {min: -30, max: 30, step: 5, default: 0},
    brightness: {min: -30, max: 30, step: 5, default: 0},
    hue: {min: -180, max: 180, step: 10, default: 0},
    temperature: {min: -50, max: 50, step: 5, default: 0},
    gamma: {min: 0.5, max: 2.0, step: 0.1, default: 1.0},
};

// Palette configuration
export const PALETTE_CONFIG = {
    totalColors: 16,
    previewColors: 6,
    shadeCount: 15,
    maxChildrenPerLine: 8,
    minChildrenPerLine: 8,
};

// Color swatch dimensions
export const SWATCH_DIMENSIONS = {
    default: {width: 35, height: 35},
    large: {width: 40, height: 40},
};
