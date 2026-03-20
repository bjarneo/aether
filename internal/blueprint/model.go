package blueprint

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
}

// Settings holds theme generation settings.
type Settings struct {
	IncludeNeovim        *bool  `json:"includeNeovim,omitempty"`
	IncludeZed           *bool  `json:"includeZed,omitempty"`
	IncludeVscode        *bool  `json:"includeVscode,omitempty"`
	IncludeGtk           *bool  `json:"includeGtk,omitempty"`
	SelectedNeovimConfig string `json:"selectedNeovimConfig,omitempty"`
}
