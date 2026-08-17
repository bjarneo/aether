package theme

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"aether/internal/platform"
)

// ApplyOmarchyTheme runs "omarchy-theme-set aether" to activate the theme.
// It also attempts to restart xdg-desktop-portal-gtk. Only runs on Linux.
func ApplyOmarchyTheme() error {
	if runtime.GOOS != "linux" {
		return nil
	}
	if _, err := platform.RunSync("omarchy-theme-set", "aether"); err != nil {
		return err
	}
	log.Println("Applied theme: aether")

	// Restart xdg-desktop-portal-gtk to pick up the new theme.
	// This is best-effort; ignore errors (it may not be running).
	_ = platform.RunAsync("killall", "xdg-desktop-portal-gtk")

	return nil
}

// IsOmarchyInstalled checks if omarchy-theme-set exists in PATH.
// Always returns false on non-Linux platforms.
func IsOmarchyInstalled() bool {
	if runtime.GOOS != "linux" {
		return false
	}
	return platform.CommandExists("omarchy-theme-set")
}

// IsOmarchyV4 reports whether Omarchy uses the v4 shell integration.
func IsOmarchyV4() bool {
	return IsOmarchyInstalled() && platform.CommandExists("omarchy-shell")
}

// HandleLightModeMarker creates or removes the light.mode marker file in
// the theme directory. The presence of this file signals light mode to
// consumers.
func HandleLightModeMarker(themeDir string, lightMode bool) error {
	markerPath := filepath.Join(themeDir, "light.mode")

	if lightMode {
		// Create empty light.mode file (ignore if it already exists)
		f, err := os.OpenFile(markerPath, os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		if err := f.Close(); err != nil {
			return err
		}
		log.Println("Created light.mode marker file")
		return nil
	}

	// Remove light.mode file if it exists
	err := os.Remove(markerPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err == nil {
		log.Println("Removed light.mode marker file")
	}
	return err
}

// CreateOmarchySymlink creates a symlink from
// ~/.config/omarchy/themes/aether -> themeDir.
// If the target already exists as a regular directory (not a symlink), it is
// removed first.
func CreateOmarchySymlink(themeDir string) error {
	omarchyDir := platform.OmarchyThemeDir()
	parentDir := filepath.Dir(omarchyDir)

	if err := platform.EnsureDir(parentDir); err != nil {
		return err
	}

	// Check if the path exists and is not a symlink
	info, err := os.Lstat(omarchyDir)
	if err == nil {
		if info.Mode()&os.ModeSymlink == 0 && info.IsDir() {
			// It's a real directory, remove it
			if err := os.RemoveAll(omarchyDir); err != nil {
				return err
			}
			log.Println("Removed existing omarchy theme directory")
		}
	}

	return platform.CreateSymlink(themeDir, omarchyDir)
}

// imageExtensions are still-image formats that Go's image.Decode handles natively.
var imageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".bmp":  true,
	".webp": true,
}

// IsImageFile returns true for still-image formats that can be decoded directly.
func IsImageFile(path string) bool {
	return imageExtensions[strings.ToLower(filepath.Ext(path))]
}

// ApplyWallpaper selects the appropriate background engine for the installed
// Omarchy version. Only runs on Linux Omarchy systems.
func ApplyWallpaper(wallpaperPath string) error {
	if runtime.GOOS != "linux" || wallpaperPath == "" || !IsOmarchyInstalled() {
		return nil
	}
	if !IsImageFile(wallpaperPath) {
		log.Printf("Skipping wallpaper apply for unsupported file type: %s", wallpaperPath)
		return nil
	}

	if IsOmarchyV4() {
		return applyOmarchyV4Wallpaper(wallpaperPath)
	}
	return applyLegacyOmarchyWallpaper(wallpaperPath)
}

func applyOmarchyV4Wallpaper(wallpaperPath string) error {
	if _, err := platform.RunSync("omarchy-theme-bg-set", wallpaperPath); err != nil {
		return fmt.Errorf("set Omarchy wallpaper: %w", err)
	}
	// A legacy swaybg layer would cover Omarchy v4's QuickShell background.
	_, _ = platform.RunSync("pkill", "-x", "swaybg")
	log.Printf("Applied Omarchy wallpaper: %s", wallpaperPath)
	return nil
}

func applyLegacyOmarchyWallpaper(wallpaperPath string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	symlinkPath := filepath.Join(home, ".config", "omarchy", "current", "background")
	if err := platform.EnsureDir(filepath.Dir(symlinkPath)); err != nil {
		return err
	}
	if err := platform.CreateSymlink(wallpaperPath, symlinkPath); err != nil {
		return err
	}

	_, _ = platform.RunSync("pkill", "-x", "swaybg")
	if err := platform.RunAsync("setsid", "uwsm-app", "--", "swaybg", "-i", symlinkPath, "-m", "fill"); err != nil {
		return fmt.Errorf("start swaybg: %w", err)
	}
	log.Printf("Applied legacy Omarchy wallpaper: %s", wallpaperPath)
	return nil
}

// ClearTheme removes the theme override symlink and CSS, then switches to the
// tokyo-night theme.
func ClearTheme() error {
	if err := RetireLegacyGTKStylesheets(); err != nil {
		return fmt.Errorf("retire legacy GTK stylesheets: %w", err)
	}

	// Delete Aether override CSS file in theme dir (cross-platform)
	overrideCss := filepath.Join(platform.ThemeDir(), "aether.override.css")
	if err := platform.DeleteFile(overrideCss); err != nil {
		log.Printf("Warning: could not delete theme override CSS: %v", err)
	}

	if runtime.GOOS != "linux" {
		return nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configDir := filepath.Join(home, ".config")

	// Delete Aether override CSS symlink
	overrideSymlink := filepath.Join(configDir, "aether", "theme.override.css")
	if err := platform.DeleteFile(overrideSymlink); err != nil {
		log.Printf("Warning: could not delete theme override symlink: %v", err)
	}

	// Switch to tokyo-night theme
	if err := platform.RunAsync("omarchy-theme-set", "tokyo-night"); err != nil {
		log.Printf("Warning: could not switch to tokyo-night: %v", err)
	} else {
		log.Println("Cleared Aether theme and switched to tokyo-night")
	}

	// Restart xdg-desktop-portal-gtk (best-effort)
	_ = platform.RunAsync("killall", "xdg-desktop-portal-gtk")

	return nil
}
