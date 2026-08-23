package cli

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"aether/internal/pending"
)

func TestRunHandleURLDoesNotLetSilentBypassURLValidation(t *testing.T) {
	url := "aether://apply?colors=https%3A%2F%2F127.0.0.1%2Ftheme.json&silent=true"
	if code := runHandleURL([]string{url}, embed.FS{}); code != 1 {
		t.Fatalf("runHandleURL() = %d; want 1", code)
	}
}

func TestRunHandleURLRejectsConflictingPaletteSources(t *testing.T) {
	url := "aether://apply?external_theme=https%3A%2F%2Fexample.com%2Ftheme.json&colors=https%3A%2F%2Fexample.com%2Fcolors.toml"
	if code := runHandleURL([]string{url}, embed.FS{}); code != 1 {
		t.Fatalf("runHandleURL() = %d; want 1", code)
	}
}

func TestBuildURLImportState(t *testing.T) {
	var content strings.Builder
	content.WriteString("mode = \"light\"\n")
	for i := 0; i < 16; i++ {
		fmt.Fprintf(&content, "color%d = \"#%06x\"\n", i, i)
	}
	path := filepath.Join(t.TempDir(), "colors.toml")
	if err := os.WriteFile(path, []byte(content.String()), 0o600); err != nil {
		t.Fatal(err)
	}

	state, err := buildURLImportState(&pending.Import{ColorsToml: path, Wallpaper: "/tmp/wallpaper.jpg"})
	if err != nil {
		t.Fatal(err)
	}
	if !state.LightMode {
		t.Fatal("colors.toml light mode was not applied")
	}
	if state.Palette[15] != "#00000f" {
		t.Errorf("palette[15] = %q; want #00000f", state.Palette[15])
	}
	if state.WallpaperPath != "/tmp/wallpaper.jpg" {
		t.Errorf("wallpaper = %q; want /tmp/wallpaper.jpg", state.WallpaperPath)
	}
}
