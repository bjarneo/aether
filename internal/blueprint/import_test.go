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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
