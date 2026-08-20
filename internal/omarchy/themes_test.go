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

func TestLoadAllThemesPreservesExtendedColors(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	root := filepath.Join(home, "themes")
	themeDir := filepath.Join(root, "distinct-accent")
	if err := os.MkdirAll(themeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := `accent = "#0fdfaf"
background = "#072626"
foreground = "#d3b58d"
red = "#504038"
green = "#3fdf1f"
yellow = "#d3b58d"
blue = "#000080"
magenta = "#add8e6"
cyan = "#0fdfaf"
bright_red = "#d3b58d"
bright_green = "#90ee90"
bright_yellow = "#b4eeb4"
bright_blue = "#0000ff"
bright_magenta = "#ffffff"
bright_cyan = "#add8e6"
`
	if err := os.WriteFile(filepath.Join(themeDir, "colors.toml"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv(extraThemeDirsEnv, root)

	themes, err := LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}
	for _, theme := range themes {
		if theme.Name != "distinct-accent" {
			continue
		}
		if got := theme.ExtendedColors["accent"]; got != "#0fdfaf" {
			t.Errorf("accent = %q, want #0fdfaf", got)
		}
		if got := theme.Colors[4]; got != "#000080" {
			t.Errorf("blue = %q, want #000080", got)
		}
		return
	}
	t.Fatal("distinct-accent theme not found")
}
