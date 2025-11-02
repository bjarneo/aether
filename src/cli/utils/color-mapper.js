/**
 * Utilities for mapping palette colors to color roles
 * Ensures consistent color role assignment between GUI and CLI
 */
export class ColorMapper {
    /**
     * Maps palette colors to color roles
     * Uses the same mapping as ColorSynthesizer._createColorAssignments()
     *
     * @param {string[]} palette - Array of exactly 16 hex color values
     * @returns {Object} Object mapping role names to color values
     * @throws {Error} If palette is invalid (not array or < 16 colors)
     */
    static mapColorsToRoles(palette) {
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
            foreground: palette[15],
            color0: palette[0],
            color1: palette[1],
            color2: palette[2],
            color3: palette[3],
            color4: palette[4],
            color5: palette[5],
            color6: palette[6],
            color7: palette[7],
            color8: palette[8],
            color9: palette[9],
            color10: palette[10],
            color11: palette[11],
            color12: palette[12],
            color13: palette[13],
            color14: palette[14],
            color15: palette[15],
        };
    }
}
