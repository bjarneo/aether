package theme

import (
	"os"
	"path/filepath"
	"testing"

	"aether/internal/icontheme"
)

func TestGenerateIconThemeMatrix(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	generators := map[string]func(*ThemeState, Settings, string) error{
		"standalone": func(state *ThemeState, settings Settings, output string) error {
			return NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOnly(state, settings, output)
		},
		"omarchy v4": func(state *ThemeState, settings Settings, output string) error {
			return NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOmarchyV4Only(state, settings, output)
		},
	}

	tests := []struct {
		name      string
		selection icontheme.Selection
		enabled   bool
		want      string
		wantFile  bool
	}{
		{
			name:      "legacy zero is automatic",
			selection: icontheme.Selection{},
			enabled:   true,
			want:      "Yaru-red\n",
			wantFile:  true,
		},
		{
			name:      "automatic retains Yaru rendering",
			selection: icontheme.Automatic(),
			enabled:   true,
			want:      "Yaru-red\n",
			wantFile:  true,
		},
		{
			name: "explicit safe missing ID is exact",
			selection: icontheme.Selection{
				Mode: icontheme.SelectionExplicit,
				ID:   "Missing-But-Safe",
			},
			enabled:  true,
			want:     "Missing-But-Safe\n",
			wantFile: true,
		},
		{
			name:      "disabled automatic is omitted",
			selection: icontheme.Automatic(),
			enabled:   false,
		},
		{
			name: "disabled explicit is omitted",
			selection: icontheme.Selection{
				Mode: icontheme.SelectionExplicit,
				ID:   "Papirus-Dark",
			},
			enabled: false,
		},
	}

	for generatorName, generate := range generators {
		generate := generate
		t.Run(generatorName, func(t *testing.T) {
			for _, tt := range tests {
				tt := tt
				t.Run(tt.name, func(t *testing.T) {
					state := NewThemeState()
					state.SetColor(5, "#ff0000")
					state.IconTheme = tt.selection
					output := t.TempDir()
					settings := Settings{IncludedApps: map[string]bool{"icons": tt.enabled}}

					if err := generate(state, settings, output); err != nil {
						t.Fatalf("generate: %v", err)
					}

					got, err := os.ReadFile(filepath.Join(output, "icons.theme"))
					if !tt.wantFile {
						if !os.IsNotExist(err) {
							t.Fatalf("disabled icons.theme exists or read failed unexpectedly: %v", err)
						}
						return
					}
					if err != nil {
						t.Fatalf("read icons.theme: %v", err)
					}
					if string(got) != tt.want {
						t.Errorf("icons.theme = %q, want %q", got, tt.want)
					}
				})
			}
		})
	}
}

func TestGenerateOnlyRejectsUnsafeExplicitIconThemeWithoutOutput(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	state := NewThemeState()
	state.IconTheme = icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "../escape"}
	output := t.TempDir()
	err := NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOnly(
		state,
		Settings{IncludedApps: map[string]bool{"icons": true}},
		output,
	)
	if err == nil {
		t.Fatal("GenerateOnly accepted an unsafe explicit icon theme")
	}
	entries, readErr := os.ReadDir(output)
	if readErr != nil {
		t.Fatalf("read output directory: %v", readErr)
	}
	if len(entries) != 0 {
		t.Errorf("GenerateOnly wrote %d entries before rejecting the icon theme", len(entries))
	}
}

func TestGenerateOmarchyV4OnlyUsesLegacyDefaultIconTarget(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	state := NewThemeState()
	state.SetColor(5, "#ff0000")
	state.IconTheme = icontheme.Selection{
		Mode: icontheme.SelectionExplicit,
		ID:   "Missing-But-Safe",
	}
	output := t.TempDir()
	if err := NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOmarchyV4Only(
		state,
		DefaultApplySettings(),
		output,
	); err != nil {
		t.Fatal(err)
	}

	got, err := os.ReadFile(filepath.Join(output, "icons.theme"))
	if err != nil {
		t.Fatalf("read icons.theme: %v", err)
	}
	if want := "Missing-But-Safe\n"; string(got) != want {
		t.Errorf("icons.theme = %q, want %q", got, want)
	}
}

func TestDisabledIconTargetCannotBeReenabledByTemplateOverrides(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	generators := map[string]func(*ThemeState, Settings, string) error{
		"standalone": func(state *ThemeState, settings Settings, output string) error {
			return NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOnly(state, settings, output)
		},
		"omarchy v4": func(state *ThemeState, settings Settings, output string) error {
			return NewWriter(omarchyV4TestTemplates, "testdata/v4").GenerateOmarchyV4Only(state, settings, output)
		},
	}

	for name, generate := range generators {
		t.Run(name, func(t *testing.T) {
			state := NewThemeState()
			state.IconTheme = icontheme.Selection{
				Mode: icontheme.SelectionExplicit,
				ID:   "Papirus-Dark",
			}
			state.AppOverrides["icons"] = map[string]string{"magenta": "#ff0000"}
			output := t.TempDir()
			settings := Settings{IncludedApps: map[string]bool{"icons": false}}

			if err := generate(state, settings, output); err != nil {
				t.Fatal(err)
			}
			if _, err := os.Stat(filepath.Join(output, "icons.theme")); !os.IsNotExist(err) {
				t.Fatalf("disabled icons.theme exists or stat failed unexpectedly: %v", err)
			}
		})
	}
}
