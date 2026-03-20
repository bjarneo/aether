package cli

import "aether/internal/template"

// MapColorsToRoles maps a 16-color ANSI palette to semantic color roles.
func MapColorsToRoles(palette [16]string) template.ColorRoles {
	return template.ColorRoles{
		Background:          palette[0],
		Foreground:          palette[7],
		Black:               palette[0],
		Red:                 palette[1],
		Green:               palette[2],
		Yellow:              palette[3],
		Blue:                palette[4],
		Magenta:             palette[5],
		Cyan:                palette[6],
		White:               palette[7],
		BrightBlack:         palette[8],
		BrightRed:           palette[9],
		BrightGreen:         palette[10],
		BrightYellow:        palette[11],
		BrightBlue:          palette[12],
		BrightMagenta:       palette[13],
		BrightCyan:          palette[14],
		BrightWhite:         palette[15],
		Accent:              palette[4], // blue
		Cursor:              palette[7], // foreground
		SelectionForeground: palette[0], // background
		SelectionBackground: palette[7], // foreground
	}
}
