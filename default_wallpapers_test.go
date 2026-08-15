package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInstallDefaultWallpapers(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	if err := installDefaultWallpapers(); err != nil {
		t.Fatal(err)
	}

	dir := filepath.Join(home, "Wallpapers", "Aether")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(entries), 8; got != want {
		t.Fatalf("bundled wallpaper count = %d; want %d", got, want)
	}

	path := filepath.Join(dir, "aether-dark-2k.jpg")
	if err := os.WriteFile(path, []byte("custom"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := installDefaultWallpapers(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(data), "custom"; got != want {
		t.Errorf("existing wallpaper = %q; want %q", got, want)
	}
}
