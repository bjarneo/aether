package blueprint

import (
	"os"
	"path/filepath"
	"testing"
)

func TestImportColorsToml(t *testing.T) {
	// Write a test file
	dir := t.TempDir()
	path := filepath.Join(dir, "colors.toml")

	content := `# UI Colors (extended)
accent = "#7aa2f7"
cursor = "#a9b1d6"

# Primary colors
foreground = "#a9b1d6"
background = "#1a1b26"

# Normal colors (ANSI 0-7)
color0 = "#15161e"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#bb9af7"
color6 = "#7dcfff"
color7 = "#a9b1d6"

# Bright colors (ANSI 8-15)
color8 = "#414868"
color9 = "#f7768e"
color10 = "#9ece6a"
color11 = "#e0af68"
color12 = "#7aa2f7"
color13 = "#bb9af7"
color14 = "#7dcfff"
color15 = "#c0caf5"
`
	os.WriteFile(path, []byte(content), 0644)

	bp, err := ImportColorsToml(path)
	if err != nil {
		t.Fatalf("ImportColorsToml failed: %v", err)
	}

	t.Logf("Name: %s", bp.Name)
	t.Logf("Colors count: %d", len(bp.Palette.Colors))

	for i, c := range bp.Palette.Colors {
		t.Logf("  color%d = %q", i, c)
	}

	if len(bp.Palette.Colors) < 16 {
		t.Errorf("expected 16 colors, got %d", len(bp.Palette.Colors))
	}

	if bp.Palette.Colors[0] != "#15161e" {
		t.Errorf("color0 = %q, want #15161e", bp.Palette.Colors[0])
	}
}

func TestImportColorsTomlFromThemeDir(t *testing.T) {
	// Try importing from actual aether theme dir
	home, _ := os.UserHomeDir()
	path := filepath.Join(home, ".config", "aether", "theme", "colors.toml")

	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skipf("No colors.toml at %s", path)
	}

	data, _ := os.ReadFile(path)
	t.Logf("File contents (first 300 bytes):\n%s", string(data)[:min(300, len(data))])

	bp, err := ImportColorsToml(path)
	if err != nil {
		t.Fatalf("ImportColorsToml failed: %v", err)
	}

	t.Logf("Name: %s", bp.Name)
	t.Logf("Colors count: %d", len(bp.Palette.Colors))
	for i, c := range bp.Palette.Colors {
		if c == "" {
			t.Errorf("  color%d is EMPTY", i)
		} else {
			t.Logf("  color%d = %s", i, c)
		}
	}
}

func TestImportJSON_BoolLockedColors(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.json")

	// This is the format that was failing: lockedColors as []bool
	content := `{
		"palette": {
			"colors": ["#040C13","#3268f6","#5cdb86","#60e6a5","#638df2","#709ef5","#6FFCFD","#89F3DB",
			            "#5581a7","#85a6ff","#a4efbd","#acf6d2","#b4cafc","#c3d7fe","#c9ffff","#dbfdf5"],
			"lockedColors": [false, true, false, false, false, false, false, false,
			                 false, false, false, false, false, false, true, false]
		},
		"name": "Test Bool Locked"
	}`
	os.WriteFile(path, []byte(content), 0644)

	bp, err := ImportJSON(path)
	if err != nil {
		t.Fatalf("ImportJSON failed: %v", err)
	}

	if bp.Name != "Test Bool Locked" {
		t.Errorf("name = %q, want %q", bp.Name, "Test Bool Locked")
	}

	// Booleans at indices 1 and 14 are true, so LockedColors should be [1, 14]
	if len(bp.Palette.LockedColors) != 2 {
		t.Fatalf("LockedColors length = %d, want 2, got %v", len(bp.Palette.LockedColors), bp.Palette.LockedColors)
	}
	if bp.Palette.LockedColors[0] != 1 || bp.Palette.LockedColors[1] != 14 {
		t.Errorf("LockedColors = %v, want [1, 14]", bp.Palette.LockedColors)
	}
}

func TestImportJSON_IntLockedColors(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.json")

	content := `{
		"palette": {
			"colors": ["#000","#111","#222","#333","#444","#555","#666","#777",
			            "#888","#999","#aaa","#bbb","#ccc","#ddd","#eee","#fff"],
			"lockedColors": [0, 15]
		},
		"name": "Test Int Locked"
	}`
	os.WriteFile(path, []byte(content), 0644)

	bp, err := ImportJSON(path)
	if err != nil {
		t.Fatalf("ImportJSON failed: %v", err)
	}

	if len(bp.Palette.LockedColors) != 2 {
		t.Fatalf("LockedColors length = %d, want 2", len(bp.Palette.LockedColors))
	}
	if bp.Palette.LockedColors[0] != 0 || bp.Palette.LockedColors[1] != 15 {
		t.Errorf("LockedColors = %v, want [0, 15]", bp.Palette.LockedColors)
	}
}

func TestImportJSON_AllFalseLockedColors(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.json")

	content := `{
		"palette": {
			"colors": ["#000","#111","#222","#333","#444","#555","#666","#777",
			            "#888","#999","#aaa","#bbb","#ccc","#ddd","#eee","#fff"],
			"lockedColors": [false, false, false, false, false, false, false, false,
			                 false, false, false, false, false, false, false, false]
		},
		"name": "All Unlocked"
	}`
	os.WriteFile(path, []byte(content), 0644)

	bp, err := ImportJSON(path)
	if err != nil {
		t.Fatalf("ImportJSON failed: %v", err)
	}

	if len(bp.Palette.LockedColors) != 0 {
		t.Errorf("LockedColors = %v, want empty (all false)", bp.Palette.LockedColors)
	}
}

func TestImportJSON_NullLockedColors(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.json")

	content := `{
		"palette": {
			"colors": ["#000","#111","#222","#333","#444","#555","#666","#777",
			            "#888","#999","#aaa","#bbb","#ccc","#ddd","#eee","#fff"],
			"lockedColors": null
		},
		"name": "Null Locked"
	}`
	os.WriteFile(path, []byte(content), 0644)

	bp, err := ImportJSON(path)
	if err != nil {
		t.Fatalf("ImportJSON failed: %v", err)
	}

	if len(bp.Palette.LockedColors) != 0 {
		t.Errorf("LockedColors = %v, want empty/nil", bp.Palette.LockedColors)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
