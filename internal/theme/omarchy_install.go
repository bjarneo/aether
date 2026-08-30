package theme

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"aether/internal/omarchy"
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
	if !omarchy.IsInstalled() {
		return fmt.Errorf("omarchy is not installed")
	}
	if omarchy.ThemeExists(name) {
		return fmt.Errorf("Omarchy theme %q already exists", name)
	}

	targetDir := filepath.Join(omarchy.UserThemesDir(), name)
	wallpaper, err := w.generateOmarchyTheme(state, settings, targetDir)
	if err != nil {
		return fmt.Errorf("generate Omarchy theme %q: %w", name, err)
	}

	if err := omarchy.ActivateTheme(name, wallpaper); err != nil {
		return fmt.Errorf("activate Omarchy theme %q: %w", name, err)
	}
	return nil
}
