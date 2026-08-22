package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetSettingsIncludesDefaultWallpaperFolder(t *testing.T) {
	configHome := t.TempDir()
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv("HOME", home)

	settings := NewApp().GetSettings()
	got, ok := settings[wallpaperFolderSetting].(string)
	if !ok {
		t.Fatalf("wallpaper folder type = %T; want string", settings[wallpaperFolderSetting])
	}
	want := filepath.Join(home, "Wallpapers")
	if got != want {
		t.Errorf("wallpaper folder = %q; want %q", got, want)
	}
}

func TestScanLocalWallpapersUsesConfiguredFolder(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	folder := t.TempDir()
	nested := filepath.Join(folder, "landscapes")
	if err := os.Mkdir(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	imagePath := filepath.Join(nested, "mountain.png")
	if err := os.WriteFile(imagePath, []byte("image"), 0o644); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	if err := app.SaveSettings(map[string]interface{}{
		wallpaperFolderSetting: folder,
	}); err != nil {
		t.Fatal(err)
	}

	wallpapers, err := app.ScanLocalWallpapers()
	if err != nil {
		t.Fatal(err)
	}
	if len(wallpapers) != 1 {
		t.Fatalf("wallpaper count = %d; want 1", len(wallpapers))
	}
	if wallpapers[0].Path != imagePath {
		t.Errorf("wallpaper path = %q; want %q", wallpapers[0].Path, imagePath)
	}
	wantName := filepath.Join("landscapes", "mountain.png")
	if wallpapers[0].Name != wantName {
		t.Errorf("wallpaper name = %q; want %q", wallpapers[0].Name, wantName)
	}
}

func TestScanLocalWallpapersReportsMissingConfiguredFolder(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	app := NewApp()
	missing := filepath.Join(t.TempDir(), "missing")
	if err := app.SaveSettings(map[string]interface{}{
		wallpaperFolderSetting: missing,
	}); err != nil {
		t.Fatal(err)
	}

	if _, err := app.ScanLocalWallpapers(); err == nil {
		t.Fatal("ScanLocalWallpapers() error = nil; want missing folder error")
	}
}
