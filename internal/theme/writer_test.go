package theme

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"aether/internal/omarchy"
)

//go:embed testdata/v4
var omarchyV4TestTemplates embed.FS

func TestPrepareThemeDirRemovesLegacyGTKStylesheet(t *testing.T) {
	targetDir := t.TempDir()
	legacyFile := filepath.Join(targetDir, "gtk.css")
	if err := os.WriteFile(legacyFile, []byte(legacyGTKMarker), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := prepareThemeDir(targetDir, &ThemeState{}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Errorf("legacy GTK stylesheet still exists: %v", err)
	}
}

func TestPrepareThemeDirPreservesUnownedGTKStylesheet(t *testing.T) {
	targetDir := t.TempDir()
	userFile := filepath.Join(targetDir, "gtk.css")
	if err := os.WriteFile(userFile, []byte("user styles"), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := prepareThemeDir(targetDir, &ThemeState{}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(userFile); err != nil {
		t.Errorf("unowned GTK stylesheet was removed: %v", err)
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
	}, Settings{IncludedApps: map[string]bool{"icons": true}}, nil, nil)

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

func TestProcessOmarchyV4TemplatesDefaultsToColorsOnly(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	for name, settings := range map[string]Settings{
		"nil included apps":   {},
		"empty included apps": {IncludedApps: map[string]bool{}},
	} {
		t.Run(name, func(t *testing.T) {
			themeDir := t.TempDir()
			writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
			writer.processOmarchyV4Templates(themeDir, map[string]string{
				"background": "#1e1e2e",
				"foreground": "#cdd6f4",
				"magenta":    "#cba6f7",
				"mode":       "dark",
			}, settings, nil, nil)

			if _, err := os.Stat(filepath.Join(themeDir, "colors.toml")); err != nil {
				t.Errorf("colors.toml was not generated: %v", err)
			}
			if _, err := os.Stat(filepath.Join(themeDir, "icons.theme")); err != nil {
				t.Errorf("icons.theme was not generated: %v", err)
			}
			for _, name := range []string{"kitty.conf", "vscode-theme.json"} {
				if _, err := os.Stat(filepath.Join(themeDir, name)); !os.IsNotExist(err) {
					t.Errorf("%s was generated without a target or color override: %v", name, err)
				}
			}
		})
	}
}

func TestProcessOmarchyV4TemplatesIncludesColorOverrideApp(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	writer.processOmarchyV4Templates(themeDir, map[string]string{
		"background": "#1e1e2e",
		"foreground": "#cdd6f4",
		"magenta":    "#cba6f7",
		"mode":       "dark",
	}, Settings{IncludedApps: map[string]bool{}}, map[string]map[string]string{
		"kitty": {"foreground": "#fab387"},
	}, nil)

	kitty, err := os.ReadFile(filepath.Join(themeDir, "kitty.conf"))
	if err != nil {
		t.Fatalf("read kitty.conf: %v", err)
	}
	if got, want := string(kitty), "foreground #fab387\nbackground #1e1e2e\n"; got != want {
		t.Errorf("kitty.conf = %q, want %q", got, want)
	}
}

func TestProcessOmarchyV4TemplatesAppliesOverrideInsteadOfNeovimPreset(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	writer.processOmarchyV4Templates(themeDir, map[string]string{
		"background": "#1e1e2e",
		"foreground": "#cdd6f4",
		"magenta":    "#cba6f7",
		"mode":       "dark",
	}, Settings{
		IncludedApps:         map[string]bool{"neovim": true},
		SelectedNeovimConfig: "preset config",
	}, map[string]map[string]string{
		"neovim": {"foreground": "#fab387"},
	}, nil)

	neovim, err := os.ReadFile(filepath.Join(themeDir, "neovim.lua"))
	if err != nil {
		t.Fatalf("read neovim.lua: %v", err)
	}
	if got, want := string(neovim), "foreground = '#fab387'\n"; got != want {
		t.Errorf("neovim.lua = %q, want %q", got, want)
	}
}

func TestProcessOmarchyV4TemplatesWritesVSCodeThemeOverride(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	writer.processOmarchyV4Templates(themeDir, map[string]string{
		"background": "#1e1e2e",
		"foreground": "#cdd6f4",
		"magenta":    "#cba6f7",
		"mode":       "dark",
	}, Settings{}, map[string]map[string]string{
		"vscode": {"background": "#1e1e2e"},
	}, nil)

	if _, err := os.Stat(filepath.Join(themeDir, "vscode.json")); !os.IsNotExist(err) {
		t.Errorf("vscode.json descriptor was generated: %v", err)
	}
	theme, err := os.ReadFile(filepath.Join(themeDir, "vscode-theme.json"))
	if err != nil {
		t.Fatalf("read vscode-theme.json: %v", err)
	}
	if got, want := string(theme), "{\"background\":\"#1e1e2e\"}\n"; got != want {
		t.Errorf("vscode-theme.json = %q, want %q", got, want)
	}
}

func TestGetAppNameFromFileNameMapsZedTemplate(t *testing.T) {
	if got, want := getAppNameFromFileName("aether.zed.json"), "zed"; got != want {
		t.Errorf("getAppNameFromFileName() = %q, want %q", got, want)
	}
}

func TestProcessTemplatesRemovesDisabledTarget(t *testing.T) {
	themeDir := t.TempDir()
	stale := filepath.Join(themeDir, "kitty.conf")
	if err := os.WriteFile(stale, []byte("stale"), 0o644); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	writer.processTemplates(nil, themeDir, Settings{IncludedApps: map[string]bool{}}, nil, nil)

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Errorf("disabled kitty target was not removed: %v", err)
	}
}

func TestGenerateOmarchyV4OnlyRemovesLegacyFiles(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	themeDir := t.TempDir()
	legacyFile := filepath.Join(themeDir, "waybar.css")
	if err := os.WriteFile(legacyFile, []byte("legacy"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := omarchy.MarkManagedTheme(themeDir); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := NewThemeState()
	state.ColorRoles.Background = "#1e1e2e"
	state.ColorRoles.Magenta = "#ff0000"
	settings := Settings{IncludedApps: map[string]bool{"icons": true}}
	if err := writer.GenerateOmarchyV4Only(state, settings, themeDir); err != nil {
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

func TestGenerateOmarchyV4OnlyRefusesUnmanagedTheme(t *testing.T) {
	themeDir := t.TempDir()
	userFile := filepath.Join(themeDir, "notes.txt")
	if err := os.WriteFile(userFile, []byte("keep me"), 0o644); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	err := writer.GenerateOmarchyV4Only(NewThemeState(), Settings{}, themeDir)
	if err == nil || !strings.Contains(err.Error(), "unmanaged") {
		t.Fatalf("GenerateOmarchyV4Only() error = %v, want unmanaged-theme refusal", err)
	}
	if data, err := os.ReadFile(userFile); err != nil || string(data) != "keep me" {
		t.Fatalf("foreign theme content changed: data=%q err=%v", data, err)
	}
}

func TestReplaceThemeDirRestoresTargetChangedDuringGeneration(t *testing.T) {
	parent := t.TempDir()
	target := filepath.Join(parent, "aether")
	staging := filepath.Join(parent, ".aether-staging")
	if err := os.Mkdir(staging, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "colors.toml"), []byte("generated"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	foreign := filepath.Join(target, "notes.txt")
	if err := os.WriteFile(foreign, []byte("keep me"), 0o644); err != nil {
		t.Fatal(err)
	}

	err := replaceThemeDir(staging, target)
	if err == nil || !strings.Contains(err.Error(), "changed during generation") {
		t.Fatalf("replaceThemeDir() error = %v, want ownership race refusal", err)
	}
	data, readErr := os.ReadFile(foreign)
	if readErr != nil || string(data) != "keep me" {
		t.Fatalf("foreign target was not restored: data=%q err=%v", data, readErr)
	}
	if _, err := os.Stat(filepath.Join(staging, "colors.toml")); err != nil {
		t.Fatalf("staging content was lost after refusal: %v", err)
	}
}

func TestGenerateOmarchyV4OnlyPreservesThemeWhenWallpaperCopyFails(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	themeDir := t.TempDir()
	background := filepath.Join(themeDir, "backgrounds", "current.jpg")
	if err := os.MkdirAll(filepath.Dir(background), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(background, []byte("original"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := omarchy.MarkManagedTheme(themeDir); err != nil {
		t.Fatal(err)
	}

	state := NewThemeState()
	state.WallpaperPath = filepath.Join(t.TempDir(), "missing.jpg")
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	if err := writer.GenerateOmarchyV4Only(state, Settings{}, themeDir); err == nil {
		t.Fatal("GenerateOmarchyV4Only() succeeded with a missing wallpaper")
	}
	data, err := os.ReadFile(background)
	if err != nil || string(data) != "original" {
		t.Fatalf("existing background changed: data=%q err=%v", data, err)
	}
}

func TestGenerateOmarchyV4OnlyPreservesThemeWhenTemplatesFail(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	themeDir := t.TempDir()
	colorsPath := filepath.Join(themeDir, "colors.toml")
	if err := os.WriteFile(colorsPath, []byte("original"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := omarchy.MarkManagedTheme(themeDir); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "missing")
	if err := writer.GenerateOmarchyV4Only(NewThemeState(), Settings{}, themeDir); err == nil {
		t.Fatal("GenerateOmarchyV4Only() succeeded without templates")
	}
	data, err := os.ReadFile(colorsPath)
	if err != nil || string(data) != "original" {
		t.Fatalf("existing theme changed: data=%q err=%v", data, err)
	}
}

func TestGenerateOnlyRejectsTemplateInjection(t *testing.T) {
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := NewThemeState()
	state.SetColor(1, `#ff0000"; os.execute("touch /tmp/pwned"); --`)

	if err := writer.GenerateOnly(state, Settings{}, t.TempDir()); err == nil {
		t.Fatal("GenerateOnly() accepted a non-color template payload")
	}
}
