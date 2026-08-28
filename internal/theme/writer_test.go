package theme

import (
	"bytes"
	"embed"
	"os"
	"path/filepath"
	"testing"

	"aether/internal/platform"
)

//go:embed testdata/v4
var omarchyV4TestTemplates embed.FS

// TestPrepareThemeDirCopiesWallpaperVariants covers the blur pair: the
// applied variant (WallpaperPath) and the unblurred source
// (OriginalWallpaperPath) must both land in backgrounds/ when they differ,
// and the returned destination must be the applied variant.
func TestPrepareThemeDirCopiesWallpaperVariants(t *testing.T) {
	srcDir := t.TempDir()
	original := filepath.Join(srcDir, "photo.png")
	blurred := filepath.Join(srcDir, "photo-blurred-a1b2c3d4.jpg")
	if err := os.WriteFile(original, []byte("original-bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(blurred, []byte("blurred-bytes"), 0o644); err != nil {
		t.Fatal(err)
	}

	targetDir := t.TempDir()
	dest, err := prepareThemeDir(targetDir, &ThemeState{
		WallpaperPath:         blurred,
		OriginalWallpaperPath: original,
	})
	if err != nil {
		t.Fatal(err)
	}

	bgDir := filepath.Join(targetDir, "backgrounds")
	wantDest := filepath.Join(bgDir, "photo-blurred-a1b2c3d4.jpg")
	if dest != wantDest {
		t.Errorf("dest = %q, want %q", dest, wantDest)
	}

	got, err := os.ReadFile(wantDest)
	if err != nil {
		t.Fatalf("blurred variant missing: %v", err)
	}
	if string(got) != "blurred-bytes" {
		t.Error("blurred variant content mismatch")
	}

	got, err = os.ReadFile(filepath.Join(bgDir, "photo.png"))
	if err != nil {
		t.Fatalf("original wallpaper missing: %v", err)
	}
	if string(got) != "original-bytes" {
		t.Error("original wallpaper content mismatch")
	}

	// Identical paths (blur off) must not duplicate the file.
	onlyDir := t.TempDir()
	dest, err = prepareThemeDir(onlyDir, &ThemeState{
		WallpaperPath:         original,
		OriginalWallpaperPath: original,
	})
	if err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(filepath.Join(onlyDir, "backgrounds"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Errorf("backgrounds has %d entries with identical paths, want 1", len(entries))
	}
	if dest != filepath.Join(onlyDir, "backgrounds", "photo.png") {
		t.Errorf("dest = %q, want the original copy", dest)
	}
}

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

func TestPrepareOmarchyV4ThemeDirClearsExistingTheme(t *testing.T) {
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

	if _, err := os.Stat(background); !os.IsNotExist(err) {
		t.Errorf("existing background was not removed: %v", err)
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
			for _, name := range []string{"icons.theme", "kitty.conf", "vscode-theme.json"} {
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
	}, Settings{IncludedApps: map[string]bool{"vscode": true}}, nil, nil)

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

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := NewThemeState()
	state.ColorRoles.Background = "#1e1e2e"
	state.ColorRoles.Magenta = "#ff0000"
	if _, err := writer.GenerateOmarchyV4Only(state, Settings{IncludedApps: map[string]bool{"icons": true}}, themeDir); err != nil {
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

func TestGenerateOnlyRejectsTemplateInjection(t *testing.T) {
	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := NewThemeState()
	state.SetColor(1, `#ff0000"; os.execute("touch /tmp/pwned"); --`)

	if _, err := writer.GenerateOnly(state, Settings{}, t.TempDir()); err == nil {
		t.Fatal("GenerateOnly() accepted a non-color template payload")
	}
}

func TestGenerateOnlyReturnsWallpaperDestination(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	srcDir := t.TempDir()
	wallpaper := filepath.Join(srcDir, "photo.png")
	png := []byte("fake image bytes")
	if err := os.WriteFile(wallpaper, png, 0o644); err != nil {
		t.Fatal(err)
	}

	writer := NewWriter(omarchyV4TestTemplates, "testdata/v4")
	state := NewThemeState()
	state.WallpaperPath = wallpaper

	dest, err := writer.GenerateOnly(state, Settings{}, "")
	if err != nil {
		t.Fatal(err)
	}

	wantDest := filepath.Join(platform.ThemeDir(), "backgrounds", "photo.png")
	if dest != wantDest {
		t.Errorf("GenerateOnly() dest = %q, want %q", dest, wantDest)
	}
	got, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("wallpaper was not copied: %v", err)
	}
	if !bytes.Equal(got, png) {
		t.Error("copied wallpaper content differs from source")
	}

	// No wallpaper -> empty destination, nothing to apply.
	dest, err = writer.GenerateOnly(NewThemeState(), Settings{}, "")
	if err != nil {
		t.Fatal(err)
	}
	if dest != "" {
		t.Errorf("dest without wallpaper = %q, want empty", dest)
	}
}
