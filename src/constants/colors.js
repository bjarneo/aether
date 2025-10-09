/**
 * Color-related constants and default values
 */

// ANSI color role definitions
export const ANSI_COLOR_ROLES = [
    {
        id: 'background',
        label: 'Background',
        description: 'Primary background color',
    },
    {id: 'foreground', label: 'Foreground', description: 'Primary text color'},
    {id: 'color0', label: 'Black (0)', description: 'ANSI color 0'},
    {id: 'color1', label: 'Red (1)', description: 'ANSI color 1'},
    {id: 'color2', label: 'Green (2)', description: 'ANSI color 2'},
    {id: 'color3', label: 'Yellow (3)', description: 'ANSI color 3'},
    {id: 'color4', label: 'Blue (4)', description: 'ANSI color 4'},
    {id: 'color5', label: 'Magenta (5)', description: 'ANSI color 5'},
    {id: 'color6', label: 'Cyan (6)', description: 'ANSI color 6'},
    {id: 'color7', label: 'White (7)', description: 'ANSI color 7'},
    {id: 'color8', label: 'Bright Black (8)', description: 'ANSI color 8'},
    {id: 'color9', label: 'Bright Red (9)', description: 'ANSI color 9'},
    {id: 'color10', label: 'Bright Green (10)', description: 'ANSI color 10'},
    {id: 'color11', label: 'Bright Yellow (11)', description: 'ANSI color 11'},
    {id: 'color12', label: 'Bright Blue (12)', description: 'ANSI color 12'},
    {id: 'color13', label: 'Bright Magenta (13)', description: 'ANSI color 13'},
    {id: 'color14', label: 'Bright Cyan (14)', description: 'ANSI color 14'},
    {id: 'color15', label: 'Bright White (15)', description: 'ANSI color 15'},
];

// Default color scheme (Catppuccin-inspired)
export const DEFAULT_COLORS = {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    color0: '#45475a',
    color1: '#f38ba8',
    color2: '#a6e3a1',
    color3: '#f9e2af',
    color4: '#89b4fa',
    color5: '#cba6f7',
    color6: '#94e2d5',
    color7: '#bac2de',
    color8: '#585b70',
    color9: '#f38ba8',
    color10: '#a6e3a1',
    color11: '#f9e2af',
    color12: '#89b4fa',
    color13: '#cba6f7',
    color14: '#94e2d5',
    color15: '#cdd6f4',
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
