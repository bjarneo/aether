package themepack_test

import (
	"os"
	"path/filepath"
	"testing"

	"aether/internal/blueprint"
	"aether/internal/themepack"
)

func TestWriteAndImportThemePackResolvesRelativeWallpaper(t *testing.T) {
	dir := t.TempDir()
	bgDir := filepath.Join(dir, "backgrounds")
	if err := os.MkdirAll(bgDir, 0755); err != nil {
		t.Fatal(err)
	}
	wallpaper := filepath.Join(bgDir, "wallpaper.jpg")
	if err := os.WriteFile(wallpaper, []byte("fake"), 0644); err != nil {
		t.Fatal(err)
	}

	bp := &blueprint.Blueprint{
		Name: "test-pack",
		Palette: blueprint.PaletteData{
			Colors:           []string{"#000000", "#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd", "#eeeeee", "#ffffff"},
			Wallpaper:        "backgrounds/wallpaper.jpg",
			AdditionalImages: []string{"backgrounds/extra.png"},
		},
	}
	manifest, err := themepack.NewManifest(dir, "Test Pack", "test-pack", []string{"triad", "zellij"}, false, "backgrounds/wallpaper.jpg", []string{"backgrounds/extra.png"})
	if err != nil {
		t.Fatal(err)
	}
	if err := themepack.Write(dir, manifest, bp); err != nil {
		t.Fatal(err)
	}

	imported, err := themepack.Import(filepath.Join(dir, themepack.ManifestFile))
	if err != nil {
		t.Fatal(err)
	}
	if imported.Palette.Wallpaper != wallpaper {
		t.Fatalf("wallpaper = %q, want %q", imported.Palette.Wallpaper, wallpaper)
	}
	wantExtra := filepath.Join(dir, "backgrounds", "extra.png")
	if got := imported.Palette.AdditionalImages[0]; got != wantExtra {
		t.Fatalf("additional image = %q, want %q", got, wantExtra)
	}
}

func TestImportRejectsUnrecognizedFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "other.json")
	if err := os.WriteFile(path, []byte("{}"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := themepack.Import(path); err == nil {
		t.Fatal("expected error for unrecognized file")
	}
}
