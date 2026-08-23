package theme

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"aether/internal/platform"
)

var omarchyThemeNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`)

// ValidOmarchyThemeName reports whether name is safe as a theme directory and
// command argument.
func ValidOmarchyThemeName(name string) bool {
	return omarchyThemeNamePattern.MatchString(name)
}

// InstallOmarchyTheme generates a new named Omarchy theme and activates it.
// Existing themes are never overwritten by web imports.
func (w *Writer) InstallOmarchyTheme(state *ThemeState, settings Settings, name string) error {
	if !ValidOmarchyThemeName(name) {
		return fmt.Errorf("invalid Omarchy theme name %q", name)
	}
	name = strings.ToLower(name)
	if !IsOmarchyInstalled() {
		return fmt.Errorf("omarchy-theme-set not found in PATH")
	}
	if err := ensureOmarchyPath(); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(os.Getenv("OMARCHY_PATH"), "themes", name)); err == nil {
		return fmt.Errorf("Omarchy theme %q already exists", name)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect built-in Omarchy theme %q: %w", name, err)
	}

	targetDir := filepath.Join(platform.OmarchyThemesDir(), name)
	if _, err := os.Lstat(targetDir); err == nil {
		return fmt.Errorf("Omarchy theme %q already exists", name)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect Omarchy theme %q: %w", name, err)
	}
	if err := platform.EnsureDir(filepath.Dir(targetDir)); err != nil {
		return fmt.Errorf("create Omarchy themes directory: %w", err)
	}
	if err := os.Mkdir(targetDir, 0o755); err != nil {
		return fmt.Errorf("create Omarchy theme %q: %w", name, err)
	}
	if err := w.GenerateOnly(state, settings, targetDir); err != nil {
		_ = os.RemoveAll(targetDir)
		return fmt.Errorf("generate Omarchy theme %q: %w", name, err)
	}

	if _, err := platform.RunSync("omarchy-theme-set", name); err != nil {
		return fmt.Errorf("activate Omarchy theme %q: %w", name, err)
	}
	return nil
}

func ensureOmarchyPath() error {
	if path := os.Getenv("OMARCHY_PATH"); platform.FileExists(filepath.Join(path, "shell", "shell.qml")) {
		return nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("resolve home directory: %w", err)
	}
	for _, path := range []string{filepath.Join(home, ".local", "share", "omarchy"), "/usr/share/omarchy"} {
		if platform.FileExists(filepath.Join(path, "shell", "shell.qml")) {
			if err := os.Setenv("OMARCHY_PATH", path); err != nil {
				return fmt.Errorf("set OMARCHY_PATH: %w", err)
			}
			return nil
		}
	}
	return fmt.Errorf("could not locate the Omarchy installation")
}
