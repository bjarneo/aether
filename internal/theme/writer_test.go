package theme

import (
	"embed"
	"os"
	"path/filepath"
	"testing"

	"aether/internal/template"
)

//go:embed testdata/v4/*
var omarchyV4TestTemplates embed.FS

func TestPrepareOmarchyV4ThemeDirRemovesLegacyFiles(t *testing.T) {
	targetDir := t.TempDir()
	background := filepath.Join(targetDir, "backgrounds", "current.jpg")
	legacyFile := filepath.Join(targetDir, "waybar.css")
	legacyDir := filepath.Join(targetDir, "vscode-extension")

	if err := os.MkdirAll(filepath.Dir(background), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(background, []byte("background"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacyFile, []byte("legacy"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(legacyDir, 0o755); err != nil {
		t.Fatal(err)
	}

	if _, err := prepareOmarchyV4ThemeDir(targetDir, &ThemeState{}); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(background); err != nil {
		t.Errorf("background was removed: %v", err)
	}
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Errorf("legacy file still exists: %v", err)
	}
	if _, err := os.Stat(legacyDir); !os.IsNotExist(err) {
		t.Errorf("legacy directory still exists: %v", err)
	}
}

func TestProcessOmarchyV4TemplatesKeepsIconsTheme(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	writer.processOmarchyV4Templates(themeDir, map[string]string{
		"background": "#1e1e2e",
		"magenta":    "#ff0000",
		"mode":       "dark",
	}, nil, nil)

	colors, err := os.ReadFile(filepath.Join(themeDir, "colors.toml"))
	if err != nil {
		t.Fatalf("read colors.toml: %v", err)
	}
	if got, want := string(colors), "background = \"#1e1e2e\"\nmode = \"dark\"\n"; got != want {
		t.Errorf("colors.toml = %q, want %q", got, want)
	}

	icons, err := os.ReadFile(filepath.Join(themeDir, "icons.theme"))
	if err != nil {
		t.Fatalf("read icons.theme: %v", err)
	}
	if got, want := string(icons), "Yaru-red\n"; got != want {
		t.Errorf("icons.theme = %q, want %q", got, want)
	}
}

func TestGenerateOmarchyV4OnlyRemovesLegacyFiles(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	legacyFile := filepath.Join(themeDir, "waybar.css")
	if err := os.WriteFile(legacyFile, []byte("legacy"), 0o644); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := &ThemeState{
		ColorRoles: template.ColorRoles{
			Background: "#1e1e2e",
			Magenta:    "#ff0000",
		},
	}
	if err := writer.GenerateOmarchyV4Only(state, themeDir); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"colors.toml", "icons.theme"} {
		if _, err := os.Stat(filepath.Join(themeDir, name)); err != nil {
			t.Errorf("%s was not generated: %v", name, err)
		}
	}
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Errorf("legacy file still exists: %v", err)
	}
}
