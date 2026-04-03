package theme

import (
	"aether/internal/color"
	"aether/internal/template"
)

// ThemeState holds all mutable state for the current theme.
type ThemeState struct {
	Palette          [16]string                   `json:"palette"`
	BasePalette      [16]string                   `json:"basePalette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	LockedColors     map[int]bool                 `json:"lockedColors"`
	Adjustments      color.Adjustments            `json:"adjustments"`
	ColorRoles       template.ColorRoles          `json:"colorRoles"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	ExtractionMode   string                       `json:"extractionMode"`
	AdditionalImages []string                     `json:"additionalImages"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
}

// DefaultPalette is the Catppuccin-inspired default 16-color palette.
var DefaultPalette = [16]string{
	"#1e1e2e", // 0: Background/Black
	"#f38ba8", // 1: Red
	"#a6e3a1", // 2: Green
	"#f9e2af", // 3: Yellow
	"#89b4fa", // 4: Blue
	"#cba6f7", // 5: Magenta
	"#94e2d5", // 6: Cyan
	"#cdd6f4", // 7: White
	"#45475a", // 8: Bright Black
	"#f38ba8", // 9: Bright Red
	"#a6e3a1", // 10: Bright Green
	"#f9e2af", // 11: Bright Yellow
	"#89b4fa", // 12: Bright Blue
	"#cba6f7", // 13: Bright Magenta
	"#94e2d5", // 14: Bright Cyan
	"#ffffff", // 15: Bright White
}

// NewThemeState returns a ThemeState initialised with default values.
func NewThemeState() *ThemeState {
	s := &ThemeState{
		Palette:          DefaultPalette,
		BasePalette:      DefaultPalette,
		LockedColors:     make(map[int]bool),
		Adjustments:      color.DefaultAdjustments(),
		ExtendedColors:   make(map[string]string),
		ExtractionMode:   "auto",
		AdditionalImages: []string{},
		AppOverrides:     make(map[string]map[string]string),
	}
	s.ColorRoles = s.buildColorRoles()
	return s
}

// SetPalette replaces both the display palette and the base palette, then rebuilds color roles.
func (s *ThemeState) SetPalette(colors [16]string) {
	s.Palette = colors
	s.BasePalette = colors
	s.ColorRoles = s.buildColorRoles()
}

// SetAdjustedPalette replaces only the display palette (keeps base unchanged).
func (s *ThemeState) SetAdjustedPalette(colors [16]string) {
	s.Palette = colors
	s.ColorRoles = s.buildColorRoles()
}

// SetColor sets a single palette colour at the given index (0-15) and
// rebuilds color roles.
func (s *ThemeState) SetColor(index int, hex string) {
	if index < 0 || index > 15 {
		return
	}
	s.Palette[index] = hex
	s.ColorRoles = s.buildColorRoles()
}

// StateSnapshot is a JSON-safe representation of ThemeState for sending to
// the Wails frontend.
type StateSnapshot struct {
	Palette          [16]string                   `json:"palette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	LockedColors     map[int]bool                 `json:"lockedColors"`
	ColorRoles       template.ColorRoles          `json:"colorRoles"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	ExtractionMode   string                       `json:"extractionMode"`
	AdditionalImages []string                     `json:"additionalImages"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
}

// Snapshot returns a copy of the current state suitable for Wails binding.
func (s *ThemeState) Snapshot() StateSnapshot {
	locked := make(map[int]bool, len(s.LockedColors))
	for k, v := range s.LockedColors {
		locked[k] = v
	}

	ext := make(map[string]string, len(s.ExtendedColors))
	for k, v := range s.ExtendedColors {
		ext[k] = v
	}

	overrides := make(map[string]map[string]string, len(s.AppOverrides))
	for app, colors := range s.AppOverrides {
		m := make(map[string]string, len(colors))
		for k, v := range colors {
			m[k] = v
		}
		overrides[app] = m
	}

	images := make([]string, len(s.AdditionalImages))
	copy(images, s.AdditionalImages)

	return StateSnapshot{
		Palette:          s.Palette,
		WallpaperPath:    s.WallpaperPath,
		LightMode:        s.LightMode,
		LockedColors:     locked,
		ColorRoles:       s.ColorRoles,
		ExtendedColors:   ext,
		ExtractionMode:   s.ExtractionMode,
		AdditionalImages: images,
		AppOverrides:     overrides,
	}
}

// semanticNames maps palette index to semantic color role name.
var semanticNames = [16]string{
	"black", "red", "green", "yellow",
	"blue", "magenta", "cyan", "white",
	"bright_black", "bright_red", "bright_green", "bright_yellow",
	"bright_blue", "bright_magenta", "bright_cyan", "bright_white",
}

// buildColorRoles constructs a ColorRoles from the current palette and
// extended color overrides.
func (s *ThemeState) buildColorRoles() template.ColorRoles {
	roles := template.ColorRoles{
		Background:    s.Palette[0],
		Foreground:    s.Palette[7],
		Black:         s.Palette[0],
		Red:           s.Palette[1],
		Green:         s.Palette[2],
		Yellow:        s.Palette[3],
		Blue:          s.Palette[4],
		Magenta:       s.Palette[5],
		Cyan:          s.Palette[6],
		White:         s.Palette[7],
		BrightBlack:   s.Palette[8],
		BrightRed:     s.Palette[9],
		BrightGreen:   s.Palette[10],
		BrightYellow:  s.Palette[11],
		BrightBlue:    s.Palette[12],
		BrightMagenta: s.Palette[13],
		BrightCyan:    s.Palette[14],
		BrightWhite:   s.Palette[15],
	}

	// Extended colors: use overrides or auto-derive from palette
	if v, ok := s.ExtendedColors["accent"]; ok && v != "" {
		roles.Accent = v
	} else {
		roles.Accent = s.Palette[4] // blue
	}

	if v, ok := s.ExtendedColors["cursor"]; ok && v != "" {
		roles.Cursor = v
	} else {
		roles.Cursor = s.Palette[7] // foreground/white
	}

	if v, ok := s.ExtendedColors["selection_foreground"]; ok && v != "" {
		roles.SelectionForeground = v
	} else {
		roles.SelectionForeground = s.Palette[0] // background
	}

	if v, ok := s.ExtendedColors["selection_background"]; ok && v != "" {
		roles.SelectionBackground = v
	} else {
		roles.SelectionBackground = s.Palette[7] // foreground/white
	}

	return roles
}
