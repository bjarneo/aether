package omarchy

import (
	"testing"
)

func TestParseColorsToml(t *testing.T) {
	sample := `# UI Colors (extended)
accent = "#7aa2f7"
cursor = "#a9b1d6"

# Primary colors
foreground = "#a9b1d6"
background = "#1a1b26"

# Selection colors
selection_foreground = "#1a1b26"
selection_background = "#a9b1d6"

# Normal colors (ANSI 0-7)
color0 = "#15161e"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#bb9af7"
color6 = "#7dcfff"
color7 = "#a9b1d6"

# Bright colors (ANSI 8-15)
color8 = "#414868"
color9 = "#f7768e"
color10 = "#9ece6a"
color11 = "#e0af68"
color12 = "#7aa2f7"
color13 = "#bb9af7"
color14 = "#7dcfff"
color15 = "#c0caf5"
`
	colors, bg, fg := ParseColorsToml(sample)

	if bg != "#1a1b26" {
		t.Errorf("bg = %q, want #1a1b26", bg)
	}
	if fg != "#a9b1d6" {
		t.Errorf("fg = %q, want #a9b1d6", fg)
	}

	empty := 0
	for i, c := range colors {
		if c == "" {
			empty++
			t.Errorf("color%d is empty", i)
		} else {
			t.Logf("color%d = %s", i, c)
		}
	}

	if colors[0] != "#15161e" {
		t.Errorf("color0 = %q, want #15161e", colors[0])
	}
	if colors[15] != "#c0caf5" {
		t.Errorf("color15 = %q, want #c0caf5", colors[15])
	}
}
