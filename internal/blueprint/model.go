package blueprint

import "encoding/json"

// Blueprint represents a saved theme configuration.
type Blueprint struct {
	Name         string                       `json:"name"`
	Palette      PaletteData                  `json:"palette"`
	Adjustments  map[string]float64           `json:"adjustments,omitempty"`
	AppOverrides map[string]map[string]string `json:"appOverrides,omitempty"`
	Settings     Settings                     `json:"settings,omitempty"`
	Timestamp    int64                        `json:"timestamp"`
	// Metadata (not persisted in the JSON, populated on load)
	Path     string `json:"-"`
	Filename string `json:"-"`
}

// PaletteData holds the palette colors and associated data.
type PaletteData struct {
	Colors           []string          `json:"colors"`
	Wallpaper        string            `json:"wallpaper,omitempty"`
	WallpaperURL     string            `json:"wallpaperUrl,omitempty"`
	LightMode        bool              `json:"lightMode,omitempty"`
	LockedColors     []int             `json:"lockedColors,omitempty"`
	ExtendedColors   map[string]string `json:"extendedColors,omitempty"`
	AdditionalImages []string          `json:"additionalImages,omitempty"`
	WallpaperSource  string            `json:"wallpaperSource,omitempty"`
}

// UnmarshalJSON handles both formats for lockedColors:
//   - []int  — indices of locked colors, e.g. [0, 15]
//   - []bool — positional booleans, e.g. [false, true, ...] → [1]
func (p *PaletteData) UnmarshalJSON(data []byte) error {
	// Use an alias to avoid infinite recursion.
	type Alias PaletteData
	raw := struct {
		Alias
		RawLocked json.RawMessage `json:"lockedColors,omitempty"`
	}{}

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*p = PaletteData(raw.Alias)

	if len(raw.RawLocked) == 0 || string(raw.RawLocked) == "null" {
		return nil
	}

	// Try []int first (the canonical format).
	var ints []int
	if err := json.Unmarshal(raw.RawLocked, &ints); err == nil {
		p.LockedColors = ints
		return nil
	}

	// Fall back to []bool (exported blueprint format).
	var bools []bool
	if err := json.Unmarshal(raw.RawLocked, &bools); err == nil {
		p.LockedColors = nil
		for i, locked := range bools {
			if locked {
				p.LockedColors = append(p.LockedColors, i)
			}
		}
		return nil
	}

	// Neither format — ignore the field rather than failing the whole import.
	p.LockedColors = nil
	return nil
}

// Settings holds theme generation settings.
type Settings struct {
	IncludeNeovim        *bool  `json:"includeNeovim,omitempty"`
	IncludeZed           *bool  `json:"includeZed,omitempty"`
	IncludeVscode        *bool  `json:"includeVscode,omitempty"`
	IncludeGtk           *bool  `json:"includeGtk,omitempty"`
	SelectedNeovimConfig string `json:"selectedNeovimConfig,omitempty"`
}
