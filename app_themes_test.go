package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestThemeFolderExists(t *testing.T) {
	configHome := t.TempDir()
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv("HOME", home)

	app := NewApp()

	if app.ThemeFolderExists("midnight") {
		t.Error("ThemeFolderExists() = true for missing folder")
	}

	// Omarchy themes dir (~/.config/omarchy/themes).
	omarchyDir := filepath.Join(configHome, "omarchy", "themes", "midnight")
	if err := os.MkdirAll(omarchyDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if !app.ThemeFolderExists("midnight") {
		t.Error("ThemeFolderExists() = false for existing omarchy theme folder")
	}

	// Saved themes dir (~/.config/aether/themes), with case/whitespace
	// normalization matching SaveAndApplyTheme's validation.
	savedDir := filepath.Join(configHome, "aether", "themes", "dusk")
	if err := os.MkdirAll(savedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if !app.ThemeFolderExists("  Dusk ") {
		t.Error("ThemeFolderExists() = false for existing saved theme folder")
	}

	// Invalid names never resolve to a folder.
	for _, bad := range []string{"", "-x", "foo/bar", "foo bar", "..", "."} {
		if app.ThemeFolderExists(bad) {
			t.Errorf("ThemeFolderExists(%q) = true; want false", bad)
		}
	}
}
