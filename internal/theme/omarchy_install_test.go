package theme

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallOmarchyThemeCreatesAndActivatesNewTheme(t *testing.T) {
	configDir := t.TempDir()
	binDir := t.TempDir()
	omarchyDir := t.TempDir()
	activatedPath := filepath.Join(t.TempDir(), "activated")
	bgSetPath := filepath.Join(t.TempDir(), "bgset")

	t.Setenv("XDG_CONFIG_HOME", configDir)
	t.Setenv("OMARCHY_PATH", omarchyDir)
	t.Setenv("AETHER_TEST_ACTIVATED", activatedPath)
	t.Setenv("AETHER_TEST_BGSET", bgSetPath)
	t.Setenv("PATH", binDir)
	if err := os.MkdirAll(filepath.Join(omarchyDir, "shell"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(omarchyDir, "shell", "shell.qml"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	script := "#!/bin/sh\nprintf '%s' \"$1\" > \"$AETHER_TEST_ACTIVATED\"\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy-theme-set"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	// omarchy-shell marks the install as Omarchy v4, which makes wallpaper
	// application go through omarchy-theme-bg-set.
	if err := os.WriteFile(filepath.Join(binDir, "omarchy-shell"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	bgSetScript := "#!/bin/sh\nprintf '%s' \"$1\" > \"$AETHER_TEST_BGSET\"\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy-theme-bg-set"), []byte(bgSetScript), 0o755); err != nil {
		t.Fatal(err)
	}

	// A wallpaper so the theme has a background to apply.
	srcDir := t.TempDir()
	wallpaper := filepath.Join(srcDir, "photo.png")
	if err := os.WriteFile(wallpaper, []byte("fake image bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	state := NewThemeState()
	state.WallpaperPath = wallpaper

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	if err := writer.InstallOmarchyTheme(state, Settings{}, "web-theme"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(activatedPath)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(data); got != "web-theme" {
		t.Errorf("activated theme = %q; want web-theme", got)
	}
	if _, err := os.Stat(filepath.Join(configDir, "omarchy", "themes", "web-theme")); err != nil {
		t.Fatalf("installed theme missing: %v", err)
	}

	// The theme's own wallpaper copy must have been applied explicitly —
	// omarchy-theme-set alone cycles backgrounds and may pick a stock image.
	applied, err := os.ReadFile(bgSetPath)
	if err != nil {
		t.Fatalf("wallpaper was not applied: %v", err)
	}
	want := filepath.Join(configDir, "omarchy", "themes", "web-theme", "backgrounds", "photo.png")
	if string(applied) != want {
		t.Errorf("applied wallpaper = %q; want %q", applied, want)
	}

	err = writer.InstallOmarchyTheme(state, Settings{}, "web-theme")
	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("second install error = %v; want already-exists error", err)
	}
}

func TestValidOmarchyThemeName(t *testing.T) {
	for _, name := range []string{"theme", "Theme-2", "theme_name.v3"} {
		if !ValidOmarchyThemeName(name) {
			t.Errorf("ValidOmarchyThemeName(%q) = false; want true", name)
		}
	}
	for _, name := range []string{"", "../theme", "theme/name", "theme name", strings.Repeat("a", 65)} {
		if ValidOmarchyThemeName(name) {
			t.Errorf("ValidOmarchyThemeName(%q) = true; want false", name)
		}
	}
}
