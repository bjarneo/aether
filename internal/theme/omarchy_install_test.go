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

	t.Setenv("XDG_CONFIG_HOME", configDir)
	t.Setenv("OMARCHY_PATH", omarchyDir)
	t.Setenv("AETHER_TEST_ACTIVATED", activatedPath)
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

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	if err := writer.InstallOmarchyTheme(NewThemeState(), Settings{}, "web-theme"); err != nil {
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

	err = writer.InstallOmarchyTheme(NewThemeState(), Settings{}, "web-theme")
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
