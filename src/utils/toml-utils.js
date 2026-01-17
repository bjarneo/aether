/**
 * TOML color file utilities
 * Parses flat TOML color format used by ethereal/colors.toml
 *
 * Expected format:
 * accent = "#7d82d9"
 * cursor = "#ffcead"
 * foreground = "#ffcead"
 * background = "#060B1E"
 * selection_foreground = "#060B1E"
 * selection_background = "#ffcead"
 * color0 = "#060B1E"
 * ...
 * color15 = "#ffcead"
 *
 * @module toml-utils
 */

/**
 * Valid required color keys in the flat TOML format
 * @type {string[]}
 */
const REQUIRED_COLOR_KEYS = [
    'background',
    'foreground',
    'color0',
    'color1',
    'color2',
    'color3',
    'color4',
    'color5',
    'color6',
    'color7',
    'color8',
    'color9',
    'color10',
    'color11',
    'color12',
    'color13',
    'color14',
    'color15',
];

/**
 * Optional extended color keys
 * @type {string[]}
 */
const EXTENDED_COLOR_KEYS = [
    'accent',
    'cursor',
    'selection_foreground',
    'selection_background',
];

/**
 * Validates a hex color string
 * @param {string} color - Color string to validate
 * @returns {boolean} Whether the color is valid hex
 */
function isValidHexColor(color) {
    if (!color || typeof color !== 'string') return false;
    const hex = color.startsWith('#') ? color.slice(1) : color;
    return /^[0-9a-fA-F]{6}$/.test(hex);
}

/**
 * Normalizes a hex color to lowercase with # prefix
 * @param {string} color - Hex color
 * @returns {string} Normalized hex color
 */
function normalizeHexColor(color) {
    if (!color) return '#000000';
    const hex = color.startsWith('#') ? color : `#${color}`;
    return hex.toLowerCase();
}

/**
 * Parses flat TOML content (key = "value" format)
 * @param {string} content - TOML file content
 * @returns {Object} Parsed key-value pairs
 */
function parseSimpleToml(content) {
    const result = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        // Skip section headers like [colors]
        if (trimmed.startsWith('[')) {
            continue;
        }

        // Match key = "value" or key = 'value' or key = value pattern
        const match = trimmed.match(
            /^([a-zA-Z0-9_]+)\s*=\s*["']?([^"'\s]+)["']?$/
        );
        if (match) {
            const key = match[1];
            const value = match[2].trim();
            result[key] = value;
        }
    }

    return result;
}

/**
 * Parses colors.toml content and returns palette array and extended colors
 *
 * @param {string} tomlContent - TOML file content
 * @returns {{colors: string[], extendedColors: Object, background: string, foreground: string}} Result object
 * @throws {Error} If content is invalid or missing required colors
 */
export function parseColorsToml(tomlContent) {
    if (!tomlContent || typeof tomlContent !== 'string') {
        throw new Error('Invalid content: expected TOML string');
    }

    const parsed = parseSimpleToml(tomlContent);

    // Check required color keys
    const missingKeys = REQUIRED_COLOR_KEYS.filter(key => !parsed[key]);
    if (missingKeys.length > 0) {
        throw new Error(`Missing required colors: ${missingKeys.join(', ')}`);
    }

    // Validate all required colors are valid hex
    const invalidColors = REQUIRED_COLOR_KEYS.filter(
        key => !isValidHexColor(parsed[key])
    );
    if (invalidColors.length > 0) {
        throw new Error(`Invalid hex colors: ${invalidColors.join(', ')}`);
    }

    // Build 16-color palette array from color0-color15
    const colors = [];
    for (let i = 0; i < 16; i++) {
        colors.push(normalizeHexColor(parsed[`color${i}`]));
    }

    // Extract extended colors (optional)
    const extendedColors = {};
    EXTENDED_COLOR_KEYS.forEach(key => {
        if (parsed[key] && isValidHexColor(parsed[key])) {
            extendedColors[key] = normalizeHexColor(parsed[key]);
        }
    });

    return {
        colors,
        extendedColors,
        background: normalizeHexColor(parsed.background),
        foreground: normalizeHexColor(parsed.foreground),
    };
}

/**
 * Checks if content appears to be flat colors.toml format
 * @param {string} content - File content
 * @returns {boolean} Whether content looks like colors.toml
 */
export function isColorsTomlFormat(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    // Check for required keys in flat format
    const hasColor0 = /color0\s*=/.test(content);
    const hasColor15 = /color15\s*=/.test(content);
    const hasBackground = /background\s*=/.test(content);

    return hasColor0 && hasColor15 && hasBackground;
}

/**
 * Generates colors.toml content from color roles
 * @param {Object} colorRoles - Color role mappings
 * @returns {string} TOML formatted string
 */
export function generateColorsToml(colorRoles) {
    const lines = [
        '# Aether Color Scheme',
        '',
        '# UI Colors (extended)',
        `accent = "${colorRoles.accent || colorRoles.blue}"`,
        `cursor = "${colorRoles.cursor || colorRoles.foreground}"`,
        '',
        '# Primary colors',
        `foreground = "${colorRoles.foreground}"`,
        `background = "${colorRoles.background}"`,
        '',
        '# Selection colors',
        `selection_foreground = "${colorRoles.selection_foreground || colorRoles.background}"`,
        `selection_background = "${colorRoles.selection_background || colorRoles.foreground}"`,
        '',
        '# Normal colors (ANSI 0-7)',
        `color0 = "${colorRoles.color0 || colorRoles.black}"`,
        `color1 = "${colorRoles.color1 || colorRoles.red}"`,
        `color2 = "${colorRoles.color2 || colorRoles.green}"`,
        `color3 = "${colorRoles.color3 || colorRoles.yellow}"`,
        `color4 = "${colorRoles.color4 || colorRoles.blue}"`,
        `color5 = "${colorRoles.color5 || colorRoles.magenta}"`,
        `color6 = "${colorRoles.color6 || colorRoles.cyan}"`,
        `color7 = "${colorRoles.color7 || colorRoles.white}"`,
        '',
        '# Bright colors (ANSI 8-15)',
        `color8 = "${colorRoles.color8 || colorRoles.bright_black}"`,
        `color9 = "${colorRoles.color9 || colorRoles.bright_red}"`,
        `color10 = "${colorRoles.color10 || colorRoles.bright_green}"`,
        `color11 = "${colorRoles.color11 || colorRoles.bright_yellow}"`,
        `color12 = "${colorRoles.color12 || colorRoles.bright_blue}"`,
        `color13 = "${colorRoles.color13 || colorRoles.bright_magenta}"`,
        `color14 = "${colorRoles.color14 || colorRoles.bright_cyan}"`,
        `color15 = "${colorRoles.color15 || colorRoles.bright_white}"`,
        '',
    ];

    return lines.join('\n');
}
