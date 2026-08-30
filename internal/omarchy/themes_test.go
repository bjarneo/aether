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
		filepath.Join("/usr/share/omarchy", "themes"),
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
		if theme.CanApply {
			t.Error("extra-root-only theme should be edit-only")
		}
		return
	}
	t.Fatal("distinct-accent theme not found")
}

func TestLoadAllThemesComposesNativeOverlay(t *testing.T) {
	home := t.TempDir()
	omarchyRoot := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("OMARCHY_PATH", omarchyRoot)
	t.Setenv(extraThemeDirsEnv, "")

	stock := filepath.Join(omarchyRoot, "themes", "native")
	user := filepath.Join(home, ".config", "omarchy", "themes", "native")
	for _, dir := range []string{filepath.Join(stock, "backgrounds"), filepath.Join(user, "backgrounds")} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	colors := `mode = "light"
background = "#eeeeee"
foreground = "#111111"
red = "#aa0000"
green = "#00aa00"
yellow = "#aaaa00"
blue = "#0000aa"
magenta = "#aa00aa"
cyan = "#00aaaa"
muted = "#777777"
bright_red = "#ff0000"
bright_green = "#00ff00"
bright_yellow = "#ffff00"
bright_blue = "#0000ff"
bright_magenta = "#ff00ff"
bright_cyan = "#00ffff"
bright_foreground = "#ffffff"
hyprland_active_border = "45deg #ff0000 #0000ff"
`
	if err := os.WriteFile(filepath.Join(stock, "colors.toml"), []byte(colors), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stock, "backgrounds", "same.png"), []byte("stock"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(user, "backgrounds", "same.png"), []byte("user"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(user, "backgrounds", "extra.webp"), []byte("user"), 0o644); err != nil {
		t.Fatal(err)
	}

	themes, err := LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}
	for _, theme := range themes {
		if theme.Name != "native" {
			continue
		}
		if !theme.IsOverlay || !theme.IsUserTheme {
			t.Errorf("overlay flags = overlay:%v user:%v", theme.IsOverlay, theme.IsUserTheme)
		}
		if !theme.CanApply {
			t.Error("native overlay theme should be applicable")
		}
		if theme.Mode != "light" {
			t.Errorf("mode = %q, want light", theme.Mode)
		}
		if got := theme.NativeColors["hyprland_active_border"]; got != "45deg #ff0000 #0000ff" {
			t.Errorf("native color = %q", got)
		}
		if len(theme.Wallpapers) != 2 {
			t.Fatalf("wallpapers = %v, want two merged images", theme.Wallpapers)
		}
		for _, path := range theme.Wallpapers {
			if filepath.Base(path) == "same.png" && path != filepath.Join(user, "backgrounds", "same.png") {
				t.Errorf("overlay wallpaper = %q, want user source", path)
			}
		}
		return
	}
	t.Fatal("native overlay theme not found")
}

func TestLoadAllThemesSkipsInvalidSymlinkTargets(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("OMARCHY_PATH", t.TempDir())
	t.Setenv(extraThemeDirsEnv, "")
	userRoot := filepath.Join(home, ".config", "omarchy", "themes")
	if err := os.MkdirAll(userRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(home, "missing"), filepath.Join(userRoot, "broken")); err != nil {
		t.Fatal(err)
	}
	fileTarget := filepath.Join(home, "theme-file")
	if err := os.WriteFile(fileTarget, []byte("not a directory"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(fileTarget, filepath.Join(userRoot, "file-link")); err != nil {
		t.Fatal(err)
	}

	themes, err := LoadAllThemes()
	if err != nil {
		t.Fatal(err)
	}
	for _, theme := range themes {
		if theme.Name == "broken" || theme.Name == "file-link" {
			t.Errorf("invalid symlink target was discovered: %s", theme.Name)
		}
	}
}
