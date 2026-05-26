package omarchy

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// slugInvalid matches anything that isn't a lowercase letter, digit, hyphen,
// or underscore. Anything matching is replaced with a single hyphen.
var slugInvalid = regexp.MustCompile(`[^a-z0-9_-]+`)

// slugCollapse collapses multiple consecutive hyphens into one.
var slugCollapse = regexp.MustCompile(`-+`)

// SlugifyThemeName normalises a user-typed theme name into a value that's
// safe to use as a directory/symlink name and that omarchy's menu can
// select without quoting issues. Spaces and punctuation become hyphens;
// the result is lowercase. Returns "" if the input has no usable
// characters, so callers can reject empty slugs.
func SlugifyThemeName(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = slugInvalid.ReplaceAllString(s, "-")
	s = slugCollapse.ReplaceAllString(s, "-")
	return strings.Trim(s, "-_")
}

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

// AETHER_EXTRA_THEME_DIRS is a colon-separated list of additional
// directories to scan for system themes, prepended to the omarchy
// defaults. Empty entries are ignored.
const extraThemeDirsEnv = "AETHER_EXTRA_THEME_DIRS"

// themeSearchDirs returns the directories where the System Themes tab
// scans for themes, in precedence order. AETHER_EXTRA_THEME_DIRS comes
// first (so distro packagers / users can override), then the omarchy
// defaults, then a generic ~/.config/themes for users on non-omarchy
// systems who keep their themes in a neutral location.
func themeSearchDirs() []string {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	var dirs []string
	for _, d := range filepath.SplitList(os.Getenv(extraThemeDirsEnv)) {
		if d != "" {
			dirs = append(dirs, d)
		}
	}
	dirs = append(dirs,
		filepath.Join(home, ".config", "omarchy", "themes"),
		filepath.Join(home, ".local", "share", "omarchy", "themes"),
		filepath.Join(home, ".config", "themes"),
	)
	return dirs
}

func isImageFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	}
	return false
}

// listBackgrounds returns absolute paths of image files in dir, sorted
// by name (os.ReadDir's default).
func listBackgrounds(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var paths []string
	for _, e := range entries {
		if isImageFile(e.Name()) {
			paths = append(paths, filepath.Join(dir, e.Name()))
		}
	}
	return paths
}

// LoadAllThemes discovers themes from user and system directories.
func LoadAllThemes() ([]Theme, error) {
	dirs := themeSearchDirs()
	if dirs == nil {
		return nil, os.ErrNotExist
	}
	currentName := GetCurrentThemeName()

	seen := make(map[string]bool)
	var themes []Theme

	for _, dir := range dirs {
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

			// ReadDir doesn't always flag symlinks on the DirEntry.
			if _, err := os.Readlink(themePath); err == nil {
				theme.IsSymlink = true
			}

			if data, err := os.ReadFile(filepath.Join(themePath, "colors.toml")); err == nil {
				colors, bg, fg, _ := ParseColorsToml(string(data))
				theme.Colors = colors[:]
				theme.Background = bg
				theme.Foreground = fg
				theme.IsAetherGenerated = true
			} else if data, err := os.ReadFile(filepath.Join(themePath, "kitty.conf")); err == nil {
				colors, bg, fg := ParseKittyConf(string(data))
				theme.Colors = colors[:]
				theme.Background = bg
				theme.Foreground = fg
			}

			theme.Wallpapers = listBackgrounds(filepath.Join(themePath, "backgrounds"))

			themes = append(themes, theme)
		}
	}

	sort.Slice(themes, func(i, j int) bool {
		return themes[i].Name < themes[j].Name
	})

	return themes, nil
}

// TokyoNightDefaults loads the tokyo-night palette and its first
// wallpaper (the "0-" file, by omarchy's naming convention) from a
// local omarchy install. Returns ok=false on standalone systems where
// the theme isn't present.
func TokyoNightDefaults() (palette [16]string, wallpaper string, ok bool) {
	for _, root := range themeSearchDirs() {
		themeDir := filepath.Join(root, "tokyo-night")
		data, err := os.ReadFile(filepath.Join(themeDir, "colors.toml"))
		if err != nil {
			continue
		}
		palette, _, _, _ = ParseColorsToml(string(data))
		if bgs := listBackgrounds(filepath.Join(themeDir, "backgrounds")); len(bgs) > 0 {
			wallpaper = bgs[0]
		}
		return palette, wallpaper, true
	}
	return
}
