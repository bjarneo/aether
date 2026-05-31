package omarchy_test

import (
	"aether/internal/omarchy"

	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestThemeSearchDirsExtraDirsFirst(t *testing.T) {
	t.Setenv(omarchy.ExtraThemeDirsEnv, "/tmp/aether-test-themes:/opt/themes")

	dirs := omarchy.ThemeSearchDirs()
	if len(dirs) < 5 {
		t.Fatalf("expected at least 5 dirs (2 extra + 3 default), got %d: %v", len(dirs), dirs)
	}
	if dirs[0] != "/tmp/aether-test-themes" {
		t.Errorf("first dir = %q, want /tmp/aether-test-themes", dirs[0])
	}
	if dirs[1] != "/opt/themes" {
		t.Errorf("second dir = %q, want /opt/themes", dirs[1])
	}

	home, _ := os.UserHomeDir()
	expectedDefaults := []string{
		filepath.Join(home, ".config", "omarchy", "themes"),
		filepath.Join(home, ".local", "share", "omarchy", "themes"),
		filepath.Join(home, ".config", "themes"),
	}
	for i, want := range expectedDefaults {
		got := dirs[2+i]
		if got != want {
			t.Errorf("default dir[%d] = %q, want %q", i, got, want)
		}
	}
}

func TestThemeSearchDirsEmptyEntries(t *testing.T) {
	t.Setenv(omarchy.ExtraThemeDirsEnv, ":/foo::/bar:")

	dirs := omarchy.ThemeSearchDirs()
	got := strings.Join(dirs, ",")
	if !strings.Contains(got, "/foo") || !strings.Contains(got, "/bar") {
		t.Errorf("expected /foo and /bar in dirs, got %v", dirs)
	}
	for _, d := range dirs {
		if d == "" {
			t.Errorf("empty entry leaked into dirs: %v", dirs)
		}
	}
}

func TestThemeSearchDirsNoEnv(t *testing.T) {
	t.Setenv(omarchy.ExtraThemeDirsEnv, "")

	dirs := omarchy.ThemeSearchDirs()
	if len(dirs) != 3 {
		t.Errorf("expected 3 default dirs without env, got %d: %v", len(dirs), dirs)
	}
}

func TestLoadAllThemesSkipsGeneratedAetherTheme(t *testing.T) {
	tmp := t.TempDir()
	configDir := filepath.Join(tmp, ".config")
	t.Setenv("HOME", tmp)
	t.Setenv("XDG_CONFIG_HOME", configDir)
	t.Setenv(omarchy.ExtraThemeDirsEnv, "")

	generatedTheme := filepath.Join(configDir, "aether", "theme")
	if err := os.MkdirAll(filepath.Join(generatedTheme, "backgrounds"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(generatedTheme, "colors.toml"), []byte("background = '#000000'\nforeground = '#ffffff'\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(generatedTheme, "backgrounds", "0-preview.jpg"), []byte("generated"), 0644); err != nil {
		t.Fatal(err)
	}

	omarchyThemes := filepath.Join(configDir, "omarchy", "themes")
	if err := os.MkdirAll(omarchyThemes, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(generatedTheme, filepath.Join(omarchyThemes, "aether")); err != nil {
		t.Fatal(err)
	}

	genericAether := filepath.Join(configDir, "themes", "aether")
	if err := os.MkdirAll(filepath.Join(genericAether, "backgrounds"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(genericAether, "colors.toml"), []byte("background = '#111111'\nforeground = '#eeeeee'\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(genericAether, "backgrounds", "aether.png"), []byte("generic"), 0644); err != nil {
		t.Fatal(err)
	}

	themes, err := omarchy.LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}

	var found []omarchy.Theme
	for _, theme := range themes {
		if theme.Name == "aether" {
			found = append(found, theme)
		}
	}
	if len(found) != 1 {
		t.Fatalf("expected one aether theme, got %d: %#v", len(found), found)
	}
	if found[0].Path != genericAether {
		t.Fatalf("aether theme path = %q, want %q", found[0].Path, genericAether)
	}
	if found[0].Source != omarchy.ThemeSourceGeneric {
		t.Fatalf("aether theme source = %q, want %q", found[0].Source, omarchy.ThemeSourceGeneric)
	}
	if found[0].ApplyMode != omarchy.ThemeApplyModeAether {
		t.Fatalf("aether apply mode = %q, want %q", found[0].ApplyMode, omarchy.ThemeApplyModeAether)
	}
	if len(found[0].Wallpapers) != 1 || !strings.HasSuffix(found[0].Wallpapers[0], "aether.png") {
		t.Fatalf("aether wallpapers = %#v, want generic wallpaper", found[0].Wallpapers)
	}
}

func TestLoadAllThemesMarksCurrentOnlyForOmarchySource(t *testing.T) {
	tmp := t.TempDir()
	configDir := filepath.Join(tmp, ".config")
	t.Setenv("HOME", tmp)
	t.Setenv("XDG_CONFIG_HOME", configDir)
	t.Setenv(omarchy.ExtraThemeDirsEnv, "")

	currentDir := filepath.Join(configDir, "omarchy", "current")
	if err := os.MkdirAll(currentDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(currentDir, "theme.name"), []byte("aura\n"), 0644); err != nil {
		t.Fatal(err)
	}

	genericAura := filepath.Join(configDir, "themes", "aura")
	if err := os.MkdirAll(genericAura, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(genericAura, "colors.toml"), []byte("background = '#111111'\nforeground = '#eeeeee'\n"), 0644); err != nil {
		t.Fatal(err)
	}

	themes, err := omarchy.LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}
	if len(themes) != 1 {
		t.Fatalf("expected one theme, got %d: %#v", len(themes), themes)
	}
	if themes[0].IsCurrentTheme {
		t.Fatalf("generic theme was marked current: %#v", themes[0])
	}
}
