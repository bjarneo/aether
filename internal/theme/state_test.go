package theme

import "testing"

// Both import paths (CLI runImportColorsToml and the GUI stageImportIntoState)
// rely on the contract that setting ExtendedColors before SetPalette makes
// buildColorRoles use the imported accent/cursor/selection rather than
// re-deriving them from the palette. Lock that contract here.
func TestSetPaletteHonorsExtendedColors(t *testing.T) {
	s := NewThemeState()
	s.ExtendedColors["accent"] = "#abcdef"
	s.ExtendedColors["cursor"] = "#111111"
	s.ExtendedColors["selection_foreground"] = "#222222"
	s.ExtendedColors["selection_background"] = "#333333"

	pal := [16]string{
		"#000000", "#010101", "#020202", "#030303",
		"#040404", "#050505", "#060606", "#070707",
		"#080808", "#090909", "#0a0a0a", "#0b0b0b",
		"#0c0c0c", "#0d0d0d", "#0e0e0e", "#0f0f0f",
	}
	s.SetPalette(pal)

	cases := map[string]struct{ got, want string }{
		"Accent":              {s.ColorRoles.Accent, "#abcdef"},
		"Cursor":              {s.ColorRoles.Cursor, "#111111"},
		"SelectionForeground": {s.ColorRoles.SelectionForeground, "#222222"},
		"SelectionBackground": {s.ColorRoles.SelectionBackground, "#333333"},
	}
	for name, c := range cases {
		if c.got != c.want {
			t.Errorf("%s = %q, want imported %q (not palette-derived)", name, c.got, c.want)
		}
	}

	// Palette-derived roles still come straight from the palette.
	if s.ColorRoles.Background != "#000000" {
		t.Errorf("Background = %q, want #000000", s.ColorRoles.Background)
	}
	if s.ColorRoles.Magenta != "#050505" {
		t.Errorf("Magenta = %q, want palette[5] #050505", s.ColorRoles.Magenta)
	}
}

// With no extended overrides, roles fall back to the palette exactly like the
// CLI's MapColorsToRoles defaults (accent=4, cursor=7, sel_fg=0, sel_bg=7),
// so switching the base16 import to this path is behaviour-preserving.
func TestSetPaletteDefaultExtendedColors(t *testing.T) {
	s := NewThemeState()
	pal := [16]string{
		"#000000", "#010101", "#020202", "#030303",
		"#040404", "#050505", "#060606", "#070707",
		"#080808", "#090909", "#0a0a0a", "#0b0b0b",
		"#0c0c0c", "#0d0d0d", "#0e0e0e", "#0f0f0f",
	}
	s.SetPalette(pal)

	if s.ColorRoles.Accent != pal[4] {
		t.Errorf("Accent = %q, want palette[4] %q", s.ColorRoles.Accent, pal[4])
	}
	if s.ColorRoles.Cursor != pal[7] {
		t.Errorf("Cursor = %q, want palette[7] %q", s.ColorRoles.Cursor, pal[7])
	}
	if s.ColorRoles.SelectionForeground != pal[0] {
		t.Errorf("SelectionForeground = %q, want palette[0] %q", s.ColorRoles.SelectionForeground, pal[0])
	}
	if s.ColorRoles.SelectionBackground != pal[7] {
		t.Errorf("SelectionBackground = %q, want palette[7] %q", s.ColorRoles.SelectionBackground, pal[7])
	}
}
