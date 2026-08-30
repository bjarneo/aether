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
	Name              string            `json:"name"`
	Path              string            `json:"path"`
	Sources           []string          `json:"sources"`
	Colors            []string          `json:"colors"`
	ExtendedColors    map[string]string `json:"extendedColors"`
	NativeColors      map[string]string `json:"nativeColors"`
	Background        string            `json:"background"`
	Foreground        string            `json:"foreground"`
	Mode              string            `json:"mode"`
	Preview           string            `json:"preview"`
	Wallpapers        []string          `json:"wallpapers"`
	IsSymlink         bool              `json:"isSymlink"`
	IsOverlay         bool              `json:"isOverlay"`
	IsUserTheme       bool              `json:"isUserTheme"`
	CanApply          bool              `json:"canApply"`
	IsCurrentTheme    bool              `json:"isCurrentTheme"`
	IsAetherGenerated bool              `json:"isAetherGenerated"`
}

// AETHER_EXTRA_THEME_DIRS is a colon-separated list of additional
// directories to scan for system themes, prepended to the omarchy
// defaults. Empty entries are ignored.
const extraThemeDirsEnv = "AETHER_EXTRA_THEME_DIRS"

// themeSearchDirs returns theme roots in overlay precedence order. Aether
// extension roots come first, followed by Omarchy user themes, stock themes,
// and the standalone fallback.
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
		UserThemesDir(),
		stockThemesDir(),
		filepath.Join(home, ".config", "themes"),
	)

	seen := make(map[string]bool, len(dirs))
	unique := make([]string, 0, len(dirs))
	for _, dir := range dirs {
		dir = filepath.Clean(dir)
		if dir == "." || seen[dir] {
			continue
		}
		seen[dir] = true
		unique = append(unique, dir)
	}
	return unique
}

func stockThemesDir() string {
	root := os.Getenv("OMARCHY_PATH")
	if root == "" {
		root = "/usr/share/omarchy"
	}
	return filepath.Join(root, "themes")
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

func mergedBackgrounds(name string, sources []string) []string {
	byName := make(map[string]string)
	for i := len(sources) - 1; i >= 0; i-- {
		for _, image := range listBackgrounds(filepath.Join(sources[i], "backgrounds")) {
			byName[filepath.Base(image)] = image
		}
	}
	home, _ := os.UserHomeDir()
	for _, image := range listBackgrounds(filepath.Join(home, ".config", "omarchy", "backgrounds", name)) {
		byName[filepath.Base(image)] = image
	}

	names := make([]string, 0, len(byName))
	for filename := range byName {
		names = append(names, filename)
	}
	sort.Strings(names)
	paths := make([]string, 0, len(names))
	for _, filename := range names {
		paths = append(paths, byName[filename])
	}
	return paths
}

func firstThemeFile(sources []string, names ...string) string {
	for _, source := range sources {
		for _, name := range names {
			path := filepath.Join(source, name)
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				return path
			}
		}
	}
	return ""
}

// LoadAllThemes discovers themes from user and system directories.
func LoadAllThemes() ([]Theme, error) {
	dirs := themeSearchDirs()
	if dirs == nil {
		return nil, os.ErrNotExist
	}
	currentName := GetCurrentThemeName()

	sourcesByName := make(map[string][]string)
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			name := entry.Name()
			themePath := filepath.Join(dir, name)
			info, err := os.Stat(themePath)
			if err != nil || !info.IsDir() {
				continue
			}
			sourcesByName[name] = append(sourcesByName[name], themePath)
		}
	}

	names := make([]string, 0, len(sourcesByName))
	for name := range sourcesByName {
		names = append(names, name)
	}
	sort.Strings(names)
	themes := make([]Theme, 0, len(names))
	userRoot := filepath.Clean(UserThemesDir())
	stockRoot := filepath.Clean(stockThemesDir())
	for _, name := range names {
		sources := sourcesByName[name]
		primary := sources[0]
		theme := Theme{
			Name:              name,
			Path:              primary,
			Sources:           sources,
			Wallpapers:        mergedBackgrounds(name, sources),
			Preview:           firstThemeFile(sources, "preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.gif", "preview.bmp"),
			IsOverlay:         len(sources) > 1,
			IsUserTheme:       filepath.Clean(filepath.Dir(primary)) == userRoot,
			IsCurrentTheme:    name == currentName,
			IsAetherGenerated: IsManagedThemeDir(primary),
		}
		theme.CanApply = len(sources) > 0
		for _, source := range sources {
			parent := filepath.Clean(filepath.Dir(source))
			if parent != userRoot && parent != stockRoot {
				theme.CanApply = false
				break
			}
		}
		if info, err := os.Lstat(primary); err == nil {
			theme.IsSymlink = info.Mode()&os.ModeSymlink != 0
		}

		if colorsPath := firstThemeFile(sources, "colors.toml"); colorsPath != "" {
			if data, err := os.ReadFile(colorsPath); err == nil {
				colors, bg, fg, mode, extended := ParseColorsTomlFull(string(data))
				theme.Colors = colors[:]
				theme.ExtendedColors = extended
				theme.NativeColors = ParseNativeColors(string(data))
				theme.Background = bg
				theme.Foreground = fg
				theme.Mode = mode
			}
		} else if kittyPath := firstThemeFile(sources, "kitty.conf"); kittyPath != "" {
			if data, err := os.ReadFile(kittyPath); err == nil {
				colors, bg, fg := ParseKittyConf(string(data))
				theme.Colors = colors[:]
				theme.Background = bg
				theme.Foreground = fg
			}
		}
		themes = append(themes, theme)
	}

	return themes, nil
}

// TokyoNightDefaults loads the tokyo-night palette and its first
// wallpaper (the "0-" file, by omarchy's naming convention) from a
// local omarchy install. Returns ok=false on standalone systems where
// the theme isn't present.
func TokyoNightDefaults() (palette [16]string, wallpaper string, ok bool) {
	themes, err := LoadAllThemes()
	if err != nil {
		return palette, "", false
	}
	for _, theme := range themes {
		if theme.Name != "tokyo-night" || len(theme.Colors) < 16 {
			continue
		}
		copy(palette[:], theme.Colors[:16])
		if len(theme.Wallpapers) > 0 {
			wallpaper = theme.Wallpapers[0]
		}
		return palette, wallpaper, true
	}
	return
}
