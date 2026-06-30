package omarchy

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetCurrentThemeNamePrefersLegacyPath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	writeThemeName(t, filepath.Join(home, ".config", "omarchy", "current", "theme.name"), "legacy\n")
	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "state\n")

	if got := GetCurrentThemeName(); got != "legacy" {
		t.Fatalf("GetCurrentThemeName() = %q, want legacy", got)
	}
}

func TestGetCurrentThemeNameFallsBackToStatePath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "state\n")

	if got := GetCurrentThemeName(); got != "state" {
		t.Fatalf("GetCurrentThemeName() = %q, want state", got)
	}
}

func TestGetCurrentThemeNameFallsBackToStateThemeSymlink(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	themeDir := filepath.Join(home, ".config", "omarchy", "themes", "tokyo-night")
	if err := os.MkdirAll(themeDir, 0o755); err != nil {
		t.Fatal(err)
	}

	currentTheme := filepath.Join(home, ".local", "state", "omarchy", "current", "theme")
	if err := os.MkdirAll(filepath.Dir(currentTheme), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(themeDir, currentTheme); err != nil {
		t.Fatal(err)
	}

	if got := GetCurrentThemeName(); got != "tokyo-night" {
		t.Fatalf("GetCurrentThemeName() = %q, want tokyo-night", got)
	}
}

func writeThemeName(t *testing.T, path, name string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(name), 0o644); err != nil {
		t.Fatal(err)
	}
}
