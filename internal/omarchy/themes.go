package omarchy

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Theme represents a discovered Omarchy theme.
type Theme struct {
	Name              string   `json:"name"`
	Path              string   `json:"path"`
	Colors            []string `json:"colors"`
	Background        string   `json:"background"`
	Foreground        string   `json:"foreground"`
	Wallpapers        []string `json:"wallpapers"`
	IsSymlink         bool     `json:"isSymlink"`
	IsCurrentTheme    bool     `json:"isCurrentTheme"`
	IsAetherGenerated bool     `json:"isAetherGenerated"`
}

// LoadAllThemes discovers themes from user and system directories.
func LoadAllThemes() ([]Theme, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	userDir := filepath.Join(home, ".config", "omarchy", "themes")
	sysDir := filepath.Join(home, ".local", "share", "omarchy", "themes")
	currentName := GetCurrentThemeName()

	seen := make(map[string]bool)
	var themes []Theme

	for _, dir := range []string{userDir, sysDir} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			name := entry.Name()
			if seen[name] {
				continue
			}
			seen[name] = true

			themePath := filepath.Join(dir, name)
			info, err := entry.Info()
			if err != nil {
				continue
			}

			theme := Theme{
				Name:           name,
				Path:           themePath,
				IsSymlink:      info.Mode()&os.ModeSymlink != 0,
				IsCurrentTheme: name == currentName,
			}

			// Check for symlink (ReadDir doesn't always report it)
			if target, err := os.Readlink(themePath); err == nil {
				theme.IsSymlink = true
				_ = target
			}

			// Try colors.toml first
			tomlPath := filepath.Join(themePath, "colors.toml")
			if data, err := os.ReadFile(tomlPath); err == nil {
				colors, bg, fg := ParseColorsToml(string(data))
				theme.Colors = colors[:]
				theme.Background = bg
				theme.Foreground = fg
				theme.IsAetherGenerated = true
			} else {
				// Fall back to kitty.conf
				kittyPath := filepath.Join(themePath, "kitty.conf")
				if data, err := os.ReadFile(kittyPath); err == nil {
					colors, bg, fg := ParseKittyConf(string(data))
					theme.Colors = colors[:]
					theme.Background = bg
					theme.Foreground = fg
				}
			}

			// Scan wallpapers
			bgDir := filepath.Join(themePath, "backgrounds")
			if entries, err := os.ReadDir(bgDir); err == nil {
				for _, e := range entries {
					ext := strings.ToLower(filepath.Ext(e.Name()))
					if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
						theme.Wallpapers = append(theme.Wallpapers, filepath.Join(bgDir, e.Name()))
					}
				}
			}

			themes = append(themes, theme)
		}
	}

	sort.Slice(themes, func(i, j int) bool {
		return themes[i].Name < themes[j].Name
	})

	return themes, nil
}
