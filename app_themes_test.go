package main

import (
	"image"
	"image/color"
	"image/png"
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

func writeTestImage(t *testing.T, dir, name string, w, h int) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 0xff})
		}
	}
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create test image: %v", err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatalf("encode test image: %v", err)
	}
	return path
}

func TestBlurWallpaperCreatesVariant(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	t.Setenv("HOME", t.TempDir())

	app := NewApp()
	src := writeTestImage(t, t.TempDir(), "photo.png", 128, 80)

	got, err := app.BlurWallpaper(src)
	if err != nil {
		t.Fatalf("BlurWallpaper: %v", err)
	}
	if got == "" {
		t.Fatal("BlurWallpaper returned empty path")
	}
	if _, err := os.Stat(got); err != nil {
		t.Fatalf("variant not created: %v", err)
	}
	ext := filepath.Ext(got)
	if ext != ".jpg" {
		t.Errorf("variant ext = %q; want .jpg", ext)
	}
}

func TestBlurWallpaperRejectsNonImage(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())

	app := NewApp()
	txt := filepath.Join(t.TempDir(), "notes.txt")
	if err := os.WriteFile(txt, []byte("not an image"), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := app.BlurWallpaper(txt); err == nil {
		t.Error("BlurWallpaper() error = nil; want error for non-image file")
	}
}

func TestBlurWallpaperRejectsMissingFile(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())

	app := NewApp()
	if _, err := app.BlurWallpaper("/nonexistent/photo.png"); err == nil {
		t.Error("BlurWallpaper() error = nil; want error for missing file")
	}
}
