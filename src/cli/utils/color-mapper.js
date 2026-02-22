/**
 * Utilities for mapping palette colors to color roles
 * Ensures consistent color role assignment between GUI and CLI
 */
export class ColorMapper {
    /**
     * Maps palette colors to color roles including extended colors
     * Uses the same mapping as ColorSynthesizer._createColorAssignments()
     *
     * @param {string[]} palette - Array of exactly 16 hex color values
     * @param {Object} [extendedColors={}] - Optional extended color overrides
     * @returns {Object} Object mapping role names to color values
     * @throws {Error} If palette is invalid (not array or < 16 colors)
     */
    static mapColorsToRoles(palette, extendedColors = {}) {
        // Validate input
        if (!Array.isArray(palette)) {
            throw new Error('Palette must be an array of colors');
        }

        if (palette.length < 16) {
            throw new Error(
                `Palette must contain at least 16 colors (got ${palette.length})`
            );
        }

        return {
            background: palette[0],
            foreground: palette[7],
            black: palette[0],
            red: palette[1],
            green: palette[2],
            yellow: palette[3],
            blue: palette[4],
            magenta: palette[5],
            cyan: palette[6],
            white: palette[7],
            bright_black: palette[8],
            bright_red: palette[9],
            bright_green: palette[10],
            bright_yellow: palette[11],
            bright_blue: palette[12],
            bright_magenta: palette[13],
            bright_cyan: palette[14],
            bright_white: palette[15],
            // Extended colors with defaults (or use overrides if present)
            accent: extendedColors.accent || palette[4], // blue
            cursor: extendedColors.cursor || palette[7], // foreground
            selection_foreground:
                extendedColors.selection_foreground || palette[0], // background
            selection_background:
                extendedColors.selection_background || palette[7], // foreground
        };
    }
}
