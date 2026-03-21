package theme

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

	"aether/internal/platform"
)

// ApplyOmarchyTheme runs "omarchy-theme-set aether" to activate the theme.
// If sync is true, it waits for the command to complete; otherwise it runs
// asynchronously. It also attempts to restart xdg-desktop-portal-gtk.
// Only runs on Linux.
func ApplyOmarchyTheme(sync bool) error {
	if runtime.GOOS != "linux" {
		return nil
	}
	var err error
	if sync {
		_, err = platform.RunSync("omarchy-theme-set", "aether")
	} else {
		err = platform.RunAsync("omarchy-theme-set", "aether")
	}
	if err != nil {
		return err
	}
	log.Println("Applied theme: aether")

	// Restart xdg-desktop-portal-gtk to pick up the new theme.
	// This is best-effort; ignore errors (it may not be running).
	if sync {
		_, _ = platform.RunSync("killall", "xdg-desktop-portal-gtk")
	} else {
		_ = platform.RunAsync("killall", "xdg-desktop-portal-gtk")
	}

	return nil
}

// IsOmarchyInstalled checks if omarchy-theme-set exists in PATH.
// Always returns false on non-Linux platforms.
func IsOmarchyInstalled() bool {
	if runtime.GOOS != "linux" {
		return false
	}
	_, err := platform.RunSync("which", "omarchy-theme-set")
	return err == nil
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
		f.Close()
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

// ApplyWallpaper creates the background symlink at
// ~/.config/omarchy/current/background pointing to wallpaperPath, then
// restarts swaybg. Only runs on Linux Omarchy systems.
func ApplyWallpaper(wallpaperPath string) error {
	if runtime.GOOS != "linux" || wallpaperPath == "" || !IsOmarchyInstalled() {
		return nil
	}

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
	log.Printf("Created wallpaper symlink: %s -> %s", symlinkPath, wallpaperPath)

	_ = platform.RunAsync("pkill", "-x", "swaybg")
	if err := platform.RunAsync("setsid", "uwsm-app", "--", "swaybg", "-i", symlinkPath, "-m", "fill"); err != nil {
		log.Printf("Warning: could not restart swaybg: %v", err)
	} else {
		log.Println("Swaybg restarted successfully")
	}

	return nil
}

// ClearTheme removes GTK CSS files, the theme override symlink and CSS,
// and switches to the tokyo-night theme.
func ClearTheme() error {
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

	// Delete GTK3 css file
	gtk3 := filepath.Join(configDir, "gtk-3.0", "gtk.css")
	if err := platform.DeleteFile(gtk3); err != nil {
		log.Printf("Warning: could not delete GTK3 css: %v", err)
	}

	// Delete GTK4 css file
	gtk4 := filepath.Join(configDir, "gtk-4.0", "gtk.css")
	if err := platform.DeleteFile(gtk4); err != nil {
		log.Printf("Warning: could not delete GTK4 css: %v", err)
	}

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
