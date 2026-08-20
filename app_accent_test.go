package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListBlueprintsIncludesExtendedColors(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	app := NewApp()
	colors := []string{
		"#000000", "#110000", "#001100", "#111100",
		"#000080", "#110011", "#001111", "#cccccc",
		"#333333", "#ff0000", "#00ff00", "#ffff00",
		"#0000ff", "#ff00ff", "#00ffff", "#ffffff",
	}

	if err := app.SaveBlueprint(SaveBlueprintRequest{
		Name:           "distinct-accent",
		Palette:        colors,
		ExtendedColors: map[string]string{"accent": "#0fdfaf"},
	}); err != nil {
		t.Fatal(err)
	}

	blueprints, err := app.ListBlueprints()
	if err != nil {
		t.Fatal(err)
	}
	if len(blueprints) != 1 {
		t.Fatalf("blueprint count = %d, want 1", len(blueprints))
	}
	palette, ok := blueprints[0]["palette"].(map[string]interface{})
	if !ok {
		t.Fatalf("palette has type %T, want map[string]interface{}", blueprints[0]["palette"])
	}
	extended, ok := palette["extendedColors"].(map[string]string)
	if !ok {
		t.Fatalf("extendedColors has type %T, want map[string]string", palette["extendedColors"])
	}
	if got := extended["accent"]; got != "#0fdfaf" {
		t.Errorf("accent = %q, want #0fdfaf", got)
	}
}

func TestImportFilePreservesExplicitAccent(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	path := filepath.Join(t.TempDir(), "colors.toml")
	content := `mode = "dark"
accent = "#0fdfaf"
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
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	result, err := app.importFile(path, "toml")
	if err != nil {
		t.Fatal(err)
	}
	if got := result.ExtendedColors["accent"]; got != "#0fdfaf" {
		t.Errorf("result accent = %q, want #0fdfaf", got)
	}
	if got := app.state.ColorRoles.Accent; got != "#0fdfaf" {
		t.Errorf("state accent = %q, want #0fdfaf", got)
	}
	if got := app.state.ColorRoles.Blue; got != "#000080" {
		t.Errorf("state blue = %q, want #000080", got)
	}
}
