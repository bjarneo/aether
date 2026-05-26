package omarchy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestThemeSearchDirsExtraDirsFirst(t *testing.T) {
	t.Setenv(extraThemeDirsEnv, "/tmp/aether-test-themes:/opt/themes")

	dirs := themeSearchDirs()
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
	t.Setenv(extraThemeDirsEnv, ":/foo::/bar:")

	dirs := themeSearchDirs()
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
	t.Setenv(extraThemeDirsEnv, "")

	dirs := themeSearchDirs()
	if len(dirs) != 3 {
		t.Errorf("expected 3 default dirs without env, got %d: %v", len(dirs), dirs)
	}
}

func TestLoadAllThemesSkipsGeneratedAetherTheme(t *testing.T) {
	tmp := t.TempDir()
	configDir := filepath.Join(tmp, ".config")
	t.Setenv("HOME", tmp)
	t.Setenv("XDG_CONFIG_HOME", configDir)
	t.Setenv(extraThemeDirsEnv, "")

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

	themes, err := LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}

	var found []Theme
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
	if len(found[0].Wallpapers) != 1 || !strings.HasSuffix(found[0].Wallpapers[0], "aether.png") {
		t.Fatalf("aether wallpapers = %#v, want generic wallpaper", found[0].Wallpapers)
	}
}
