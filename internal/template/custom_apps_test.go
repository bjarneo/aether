package template

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestProcessCustomApps_NoDir(t *testing.T) {
	themeDir := t.TempDir()
	// Point to a non-existent custom dir — should return nil, not error.
	orig := os.Getenv("XDG_CONFIG_HOME")
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "nonexistent"))
	defer func() {
		if orig != "" {
			os.Setenv("XDG_CONFIG_HOME", orig)
		} else {
			os.Unsetenv("XDG_CONFIG_HOME")
		}
	}()

	err := ProcessCustomApps(themeDir, map[string]string{"background": "#1e1e2e"})
	if err != nil {
		t.Fatalf("expected nil error for missing custom dir, got: %v", err)
	}
}

func TestProcessCustomApps_EmptyDir(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	if err := os.MkdirAll(customDir, 0755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{"background": "#1e1e2e"})
	if err != nil {
		t.Fatalf("expected nil error for empty custom dir, got: %v", err)
	}
}

func TestProcessCustomApps_SkipsFiles(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	if err := os.MkdirAll(customDir, 0755); err != nil {
		t.Fatal(err)
	}
	// Create a regular file (not a directory) — should be skipped.
	if err := os.WriteFile(filepath.Join(customDir, "stray-file.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{})
	if err != nil {
		t.Fatalf("expected nil error when skipping non-dir entries, got: %v", err)
	}
}

func TestProcessCustomApps_FullWorkflow(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	appDir := filepath.Join(customDir, "testapp")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Write config.json
	config := customAppConfig{
		Template:    "theme.conf",
		Destination: filepath.Join(t.TempDir(), "dest", "testapp-theme"),
	}
	configData, _ := json.Marshal(config)
	if err := os.WriteFile(filepath.Join(appDir, "config.json"), configData, 0644); err != nil {
		t.Fatal(err)
	}

	// Write template file
	templateContent := `bg = {background}
fg = {foreground}
accent_strip = {accent.strip}
rgb = {red.rgb}
rgba = {blue.rgba:0.7}
`
	if err := os.WriteFile(filepath.Join(appDir, "theme.conf"), []byte(templateContent), 0644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	variables := map[string]string{
		"background": "#1e1e2e",
		"foreground": "#cdd6f4",
		"accent":     "#89b4fa",
		"red":        "#f38ba8",
		"blue":       "#89b4fa",
	}

	err := ProcessCustomApps(themeDir, variables)
	if err != nil {
		t.Fatalf("ProcessCustomApps failed: %v", err)
	}

	// Verify the processed file was written to themeDir
	outputPath := filepath.Join(themeDir, "testapp-theme.conf")
	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("expected output file at %s: %v", outputPath, err)
	}

	output := string(data)

	// Check substitutions
	assertContains(t, output, "bg = #1e1e2e")
	assertContains(t, output, "fg = #cdd6f4")
	assertContains(t, output, "accent_strip = 89b4fa")
	assertContains(t, output, "rgb = 243,139,168")
	assertContains(t, output, "rgba = rgba(137, 180, 250, 0.7)")

	// Verify symlink was created
	linkTarget, err := os.Readlink(config.Destination)
	if err != nil {
		t.Fatalf("expected symlink at %s: %v", config.Destination, err)
	}
	if linkTarget != outputPath {
		t.Errorf("symlink target = %s, want %s", linkTarget, outputPath)
	}
}

func TestProcessCustomApps_MissingConfigJSON(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	appDir := filepath.Join(customDir, "noconfigapp")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}
	// No config.json — should log and skip, not error.
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{})
	if err != nil {
		t.Fatalf("expected nil error for missing config.json, got: %v", err)
	}
}

func TestProcessCustomApps_EmptyTemplateField(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	appDir := filepath.Join(customDir, "emptytemplate")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}

	config := customAppConfig{Template: "", Destination: ""}
	configData, _ := json.Marshal(config)
	if err := os.WriteFile(filepath.Join(appDir, "config.json"), configData, 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{})
	if err != nil {
		t.Fatalf("expected nil error for empty template field, got: %v", err)
	}
}

func TestProcessCustomApps_MissingTemplateFile(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	appDir := filepath.Join(customDir, "missingfile")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}

	config := customAppConfig{Template: "nonexistent.conf", Destination: ""}
	configData, _ := json.Marshal(config)
	if err := os.WriteFile(filepath.Join(appDir, "config.json"), configData, 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{})
	if err != nil {
		t.Fatalf("expected nil error for missing template file, got: %v", err)
	}
}

func TestProcessCustomApps_NoDestination(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	appDir := filepath.Join(customDir, "nodest")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}

	config := customAppConfig{Template: "theme.conf", Destination: ""}
	configData, _ := json.Marshal(config)
	if err := os.WriteFile(filepath.Join(appDir, "config.json"), configData, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(appDir, "theme.conf"), []byte("bg={background}"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{"background": "#000000"})
	if err != nil {
		t.Fatalf("expected nil error with no destination, got: %v", err)
	}

	// Output file should still exist
	outputPath := filepath.Join(themeDir, "nodest-theme.conf")
	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("expected output file: %v", err)
	}
	if string(data) != "bg=#000000" {
		t.Errorf("output = %q, want %q", string(data), "bg=#000000")
	}
}

func TestProcessCustomApps_MultipleApps(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	// Create two custom apps
	for _, appName := range []string{"app1", "app2"} {
		appDir := filepath.Join(customDir, appName)
		if err := os.MkdirAll(appDir, 0755); err != nil {
			t.Fatal(err)
		}
		config := customAppConfig{Template: "t.conf"}
		configData, _ := json.Marshal(config)
		os.WriteFile(filepath.Join(appDir, "config.json"), configData, 0644)
		os.WriteFile(filepath.Join(appDir, "t.conf"), []byte("{foreground}"), 0644)
	}

	themeDir := t.TempDir()
	err := ProcessCustomApps(themeDir, map[string]string{"foreground": "#ffffff"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Both outputs should exist
	for _, name := range []string{"app1-t.conf", "app2-t.conf"} {
		data, err := os.ReadFile(filepath.Join(themeDir, name))
		if err != nil {
			t.Errorf("missing output %s: %v", name, err)
			continue
		}
		if string(data) != "#ffffff" {
			t.Errorf("%s content = %q, want %q", name, string(data), "#ffffff")
		}
	}
}

func TestReadCustomOverride_Found(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	if err := os.MkdirAll(customDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Place a custom override file
	overrideContent := "custom bg={background}\ncustom fg={foreground}"
	if err := os.WriteFile(filepath.Join(customDir, "kitty.conf"), []byte(overrideContent), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	content, found := ReadCustomOverride("kitty.conf")
	if !found {
		t.Fatal("expected override to be found")
	}
	if content != overrideContent {
		t.Errorf("content = %q, want %q", content, overrideContent)
	}
}

func TestReadCustomOverride_NotFound(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	if err := os.MkdirAll(customDir, 0755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	_, found := ReadCustomOverride("nonexistent.conf")
	if found {
		t.Fatal("expected override NOT to be found")
	}
}

func TestReadCustomOverride_IgnoresDirectories(t *testing.T) {
	xdgConfig := t.TempDir()
	customDir := filepath.Join(xdgConfig, "aether", "custom")
	// Create a directory with the same name as a template file
	if err := os.MkdirAll(filepath.Join(customDir, "kitty.conf"), 0755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)

	_, found := ReadCustomOverride("kitty.conf")
	if found {
		t.Fatal("expected directory to NOT be treated as an override")
	}
}

func TestReadCustomOverride_CustomDirMissing(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "nonexistent"))

	_, found := ReadCustomOverride("kitty.conf")
	if found {
		t.Fatal("expected false when custom dir doesn't exist")
	}
}

func TestExpandHome(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("cannot determine home dir")
	}

	tests := []struct {
		name string
		in   string
		want string
	}{
		{"tilde prefix", "~/foo/bar", filepath.Join(home, "foo/bar")},
		{"absolute path", "/usr/local/bin", "/usr/local/bin"},
		{"relative path", "some/relative", "some/relative"},
		{"tilde only", "~/", home},
		{"tilde no slash", "~nope", "~nope"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := expandHome(tt.in)
			if got != tt.want {
				t.Errorf("expandHome(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func assertContains(t *testing.T, s, substr string) {
	t.Helper()
	if !containsString(s, substr) {
		t.Errorf("expected output to contain %q, got:\n%s", substr, s)
	}
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
