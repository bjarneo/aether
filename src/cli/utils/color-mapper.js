/**
 * Utilities for mapping palette colors to color roles
 */
export class ColorMapper {
    /**
     * Maps palette colors to color roles
     * Uses the same mapping as ColorSynthesizer._createColorAssignments()
     *
     * @param {string[]} palette - Array of 16 color values
     * @returns {Object} Object mapping role names to color values
     */
    static mapColorsToRoles(palette) {
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
