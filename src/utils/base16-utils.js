/**
 * Base16 color scheme utilities
 * Parses and converts Base16 YAML color schemes to Aether palette format
 *
 * Base16 Format:
 * - scheme: "Scheme Name"
 * - author: "Author Name"
 * - base00 through base0F: 6-character hex colors (without #)
 *
 * @module base16-utils
 */

/**
 * Parses a simple YAML string (key: value format)
 * Handles quoted and unquoted values, and inline comments
 * @param {string} yamlContent - YAML file content
 * @returns {Object} Parsed key-value pairs
 */
function parseSimpleYaml(yamlContent) {
    const result = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and full-line comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        // Match key: value pattern
        const match = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
        if (match) {
            const key = match[1];
            let value = match[2].trim();

            // Handle quoted values (preserve content inside quotes, strip quotes)
            if (value.startsWith('"')) {
                // Find closing double quote
                const endQuote = value.indexOf('"', 1);
                if (endQuote !== -1) {
                    value = value.substring(1, endQuote);
                }
            } else if (value.startsWith("'")) {
                // Find closing single quote
                const endQuote = value.indexOf("'", 1);
                if (endQuote !== -1) {
                    value = value.substring(1, endQuote);
                }
            } else {
                // Unquoted value - strip inline comments
                const commentIndex = value.indexOf('#');
                if (commentIndex !== -1) {
                    value = value.substring(0, commentIndex).trim();
                }
            }

            result[key] = value;
        }
    }

    return result;
}

/**
 * Validates a hex color string (with or without #)
 * @param {string} color - Color string to validate
 * @returns {boolean} Whether the color is valid
 */
function isValidHexColor(color) {
    const hex = color.startsWith('#') ? color.slice(1) : color;
    return /^[0-9a-fA-F]{6}$/.test(hex);
}

/**
 * Normalizes a hex color to include # prefix
 * @param {string} color - Hex color (with or without #)
 * @returns {string} Hex color with # prefix
 */
function normalizeHexColor(color) {
    if (!color) return '#000000';
    const hex = color.startsWith('#') ? color : `#${color}`;
    return hex.toLowerCase();
}

/**
 * Base16 color slot names (base00 through base0F)
 * @type {string[]}
 */
const BASE16_KEYS = [
    'base00',
    'base01',
    'base02',
    'base03',
    'base04',
    'base05',
    'base06',
    'base07',
    'base08',
    'base09',
    'base0A',
    'base0B',
    'base0C',
    'base0D',
    'base0E',
    'base0F',
];

/**
 * Maps Base16 colors to ANSI terminal color indices (0-15)
 *
 * Base16 color meanings:
 * - base00: Default Background
 * - base01: Lighter Background (status bars)
 * - base02: Selection Background
 * - base03: Comments, Invisibles (bright black)
 * - base04: Dark Foreground
 * - base05: Default Foreground (normal white)
 * - base06: Light Foreground
 * - base07: Light Background (bright white)
 * - base08: Red (variables, errors)
 * - base09: Orange (integers, constants)
 * - base0A: Yellow (classes, search)
 * - base0B: Green (strings)
 * - base0C: Cyan (support, regex)
 * - base0D: Blue (functions)
 * - base0E: Magenta (keywords)
 * - base0F: Brown (deprecated)
 *
 * ANSI terminal colors (0-15):
 * 0: Black    1: Red      2: Green    3: Yellow
 * 4: Blue     5: Magenta  6: Cyan     7: White
 * 8: Bright Black  9: Bright Red  10: Bright Green  11: Bright Yellow
 * 12: Bright Blue  13: Bright Magenta  14: Bright Cyan  15: Bright White
 *
 * @param {Object} parsed - Parsed Base16 color values
 * @returns {string[]} Array of 16 hex colors in ANSI order
 */
function mapBase16ToAnsi(parsed) {
    // Standard Base16 to ANSI mapping used by base16-shell
    return [
        normalizeHexColor(parsed.base00), // 0: Black (background)
        normalizeHexColor(parsed.base08), // 1: Red
        normalizeHexColor(parsed.base0B), // 2: Green
        normalizeHexColor(parsed.base0A), // 3: Yellow
        normalizeHexColor(parsed.base0D), // 4: Blue
        normalizeHexColor(parsed.base0E), // 5: Magenta
        normalizeHexColor(parsed.base0C), // 6: Cyan
        normalizeHexColor(parsed.base05), // 7: White (foreground)
        normalizeHexColor(parsed.base03), // 8: Bright Black (comments)
        normalizeHexColor(parsed.base08), // 9: Bright Red (same as red)
        normalizeHexColor(parsed.base0B), // 10: Bright Green (same as green)
        normalizeHexColor(parsed.base0A), // 11: Bright Yellow (same as yellow)
        normalizeHexColor(parsed.base0D), // 12: Bright Blue (same as blue)
        normalizeHexColor(parsed.base0E), // 13: Bright Magenta (same as magenta)
        normalizeHexColor(parsed.base0C), // 14: Bright Cyan (same as cyan)
        normalizeHexColor(parsed.base07), // 15: Bright White
    ];
}

/**
 * Parses Base16 YAML content and returns an array of 16 hex colors in ANSI order
 *
 * @param {string} yamlContent - Base16 YAML file content
 * @returns {Object} Result object with colors array and metadata
 * @throws {Error} If content is not valid Base16 format
 */
export function parseBase16Yaml(yamlContent) {
    if (!yamlContent || typeof yamlContent !== 'string') {
        throw new Error('Invalid content: expected YAML string');
    }

    const parsed = parseSimpleYaml(yamlContent);

    // Validate we have all required base colors
    const missingKeys = BASE16_KEYS.filter(key => !parsed[key]);
    if (missingKeys.length > 0) {
        throw new Error(`Missing Base16 colors: ${missingKeys.join(', ')}`);
    }

    // Validate all colors are valid hex
    const invalidColors = BASE16_KEYS.filter(
        key => !isValidHexColor(parsed[key])
    );
    if (invalidColors.length > 0) {
        throw new Error(`Invalid hex colors: ${invalidColors.join(', ')}`);
    }

    // Map Base16 colors to ANSI terminal color order
    const colors = mapBase16ToAnsi(parsed);

    return {
        scheme: parsed.scheme || 'Unknown Scheme',
        author: parsed.author || 'Unknown Author',
        colors: colors,
    };
}

/**
 * Checks if a file appears to be a Base16 YAML file
 * @param {string} content - File content
 * @returns {boolean} Whether the file looks like Base16 format
 */
export function isBase16Format(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    // Check for at least base00 and base0F
    const hasBase00 = /base00\s*:/i.test(content);
    const hasBase0F = /base0F\s*:/i.test(content);

    return hasBase00 && hasBase0F;
}

/**
 * Gets supported import format information
 * @returns {Object[]} Array of format descriptors
 */
export function getSupportedFormats() {
    return [
        {
            id: 'base16',
            name: 'Base16',
            description: 'Base16 YAML color scheme (.yaml, .yml)',
            extensions: ['.yaml', '.yml'],
            mimeTypes: ['application/x-yaml', 'text/yaml', 'text/x-yaml'],
        },
    ];
}
