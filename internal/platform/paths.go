package platform

import (
	"os"
	"path/filepath"
	"runtime"
)

// ConfigDir returns ~/.config/aether.
func ConfigDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = filepath.Join(homeDir(), ".config")
	}
	return filepath.Join(dir, "aether")
}

// CacheDir returns ~/.cache/aether.
func CacheDir() string {
	dir, err := os.UserCacheDir()
	if err != nil {
		dir = filepath.Join(homeDir(), ".cache")
	}
	return filepath.Join(dir, "aether")
}

// DataDir returns the platform-specific data directory for Aether.
// Linux: ~/.local/share/aether (XDG)
// macOS: ~/Library/Application Support/aether (via os.UserConfigDir)
func DataDir() string {
	if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
		return filepath.Join(xdg, "aether")
	}
	if runtime.GOOS == "darwin" {
		// macOS: use ~/Library/Application Support
		dir, err := os.UserConfigDir()
		if err == nil {
			return filepath.Join(dir, "aether", "data")
		}
	}
	return filepath.Join(homeDir(), ".local", "share", "aether")
}

// ThemeDir returns ~/.config/aether/theme.
func ThemeDir() string {
	return filepath.Join(ConfigDir(), "theme")
}

// BlueprintDir returns ~/.config/aether/blueprints.
func BlueprintDir() string {
	return filepath.Join(ConfigDir(), "blueprints")
}

// FavoritesFile returns ~/.config/aether/favorites.json.
func FavoritesFile() string {
	return filepath.Join(ConfigDir(), "favorites.json")
}

// CustomDir returns ~/.config/aether/custom.
func CustomDir() string {
	return filepath.Join(ConfigDir(), "custom")
}

// OmarchyThemesDir returns ~/.config/omarchy/themes.
func OmarchyThemesDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = filepath.Join(homeDir(), ".config")
	}
	return filepath.Join(dir, "omarchy", "themes")
}

// OmarchyThemeDir returns ~/.config/omarchy/themes/aether.
func OmarchyThemeDir() string {
	return filepath.Join(OmarchyThemesDir(), "aether")
}

// WallpaperDir returns ~/Wallpapers, the default local scan directory.
func WallpaperDir() string {
	return filepath.Join(homeDir(), "Wallpapers")
}

// DownloadDir returns ~/.local/share/aether/wallpapers.
func DownloadDir() string {
	return filepath.Join(DataDir(), "wallpapers")
}

// ThumbnailDir returns ~/.cache/aether/thumbnails.
func ThumbnailDir() string {
	return filepath.Join(CacheDir(), "thumbnails")
}

// ColorCacheDir returns ~/.cache/aether/color-cache.
func ColorCacheDir() string {
	return filepath.Join(CacheDir(), "color-cache")
}

// EnsureAllDirs creates all directories required by Aether. It does not create
// WallpaperDir because that is user-managed.
func EnsureAllDirs() error {
	dirs := []string{
		ConfigDir(),
		CacheDir(),
		DataDir(),
		ThemeDir(),
		BlueprintDir(),
		CustomDir(),
		DownloadDir(),
		ThumbnailDir(),
		ColorCacheDir(),
	}
	// Omarchy directories are Linux-only
	if runtime.GOOS == "linux" {
		dirs = append(dirs, OmarchyThemeDir())
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return err
		}
	}
	return nil
}

// homeDir returns the current user's home directory.
func homeDir() string {
	dir, err := os.UserHomeDir()
	if err != nil {
		if runtime.GOOS == "darwin" {
			return filepath.Join("/Users", os.Getenv("USER"))
		}
		return filepath.Join("/home", os.Getenv("USER"))
	}
	return dir
}
