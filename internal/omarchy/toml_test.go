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
	colors, bg, fg, _ := ParseColorsToml(sample)

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

// A colors.toml in omarchy's semantic form: no color0-15 slots, slot 5 named
// "purple", slot 8 "muted", and a fg/bg shade ramp. The parser must still
// reconstruct a full 16-slot palette by falling back across the names.
func TestParseColorsTomlSemantic(t *testing.T) {
	sample := `mode = "dark"

accent = "#7aa2f7"
cursor = "#c0caf5"
foreground = "#a9b1d6"
background = "#1a1b26"
selection_foreground = "#c0caf5"
selection_background = "#7aa2f7"

bg = "#1a1b26"
lighter_bg = "#24283b"
selection = "#292e42"
muted = "#414868"
dark_fg = "#565f89"
fg = "#737aa2"
light_fg = "#a9b1d6"
bright_fg = "#cfc9c2"

red = "#f7768e"
yellow = "#e0af68"
green = "#9ece6a"
cyan = "#449dab"
blue = "#7aa2f7"
purple = "#ad8ee6"
bright_red = "#ff7a93"
bright_yellow = "#ff9e64"
bright_green = "#b9f27c"
bright_cyan = "#0db9d7"
bright_blue = "#7da6ff"
bright_purple = "#bb9af7"
`
	colors, bg, fg, mode := ParseColorsToml(sample)

	if mode != "dark" {
		t.Errorf("mode = %q, want dark", mode)
	}
	if bg != "#1a1b26" {
		t.Errorf("bg = %q, want #1a1b26", bg)
	}
	if fg != "#a9b1d6" {
		t.Errorf("fg = %q, want #a9b1d6 (primary foreground, not the dimmed fg key)", fg)
	}

	want := map[int]string{
		0:  "#1a1b26", // bg (no color0)
		1:  "#f7768e", // red
		5:  "#ad8ee6", // purple -> magenta slot
		6:  "#449dab", // cyan
		7:  "#a9b1d6", // foreground anchor, not the dimmed fg
		8:  "#414868", // muted -> bright black slot
		9:  "#ff7a93", // bright_red
		13: "#bb9af7", // bright_purple -> bright magenta slot
		15: "#cfc9c2", // bright_fg
	}
	for idx, exp := range want {
		if colors[idx] != exp {
			t.Errorf("color%d = %q, want %q", idx, colors[idx], exp)
		}
	}
	for i, c := range colors {
		if c == "" {
			t.Errorf("color%d is empty; semantic palette should fully reconstruct", i)
		}
	}
}

// ParseColorsTomlFull must surface the theme's explicit accent/cursor/
// selection colors so imports stay faithful instead of re-deriving them.
func TestParseColorsTomlFullExtended(t *testing.T) {
	sample := `mode = "dark"
accent = "#7aa2f7"
cursor = "#c0caf5"
foreground = "#a9b1d6"
background = "#1a1b26"
selection_foreground = "#c0caf5"
selection_background = "#7aa2f7"
red = "#f7768e"
purple = "#ad8ee6"
`
	_, _, _, _, ext := ParseColorsTomlFull(sample)

	want := map[string]string{
		"accent":               "#7aa2f7",
		"cursor":               "#c0caf5",
		"selection_foreground": "#c0caf5",
		"selection_background": "#7aa2f7",
	}
	for k, v := range want {
		if ext[k] != v {
			t.Errorf("extended[%q] = %q, want %q", k, ext[k], v)
		}
	}
	// Palette slots and bg/fg should NOT leak into extended.
	if _, ok := ext["red"]; ok {
		t.Errorf("extended should not contain palette slot keys, got red=%q", ext["red"])
	}
	if _, ok := ext["background"]; ok {
		t.Errorf("extended should not contain background anchor")
	}
}

func TestParseColorsTomlMode(t *testing.T) {
	cases := map[string]struct {
		content string
		want    string
	}{
		"explicit light":        {`mode = "light"` + "\nbackground = \"#fff\"\n", "light"},
		"explicit dark":         {`mode = "dark"` + "\nbackground = \"#000\"\n", "dark"},
		"light_mode true":       {`light_mode = true` + "\nbackground = \"#fff\"\n", "light"},
		"light_mode false":      {"light_mode = false\nbackground = \"#000\"\n", "dark"},
		"unspecified":           {"background = \"#000\"\n", ""},
		"invalid mode ignored":  {`mode = "sepia"` + "\nbackground = \"#aaa\"\n", ""},
		"case-insensitive mode": {`mode = "LIGHT"` + "\n", "light"},
	}
	for name, tc := range cases {
		_, _, _, got := ParseColorsToml(tc.content)
		if got != tc.want {
			t.Errorf("%s: mode = %q, want %q", name, got, tc.want)
		}
	}
}
