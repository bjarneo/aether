package template

import (
	"sort"
	"strings"
	"testing"
)

func TestExtractVariableNames(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{
			name:  "simple variable",
			input: "{background}",
			want:  []string{"background"},
		},
		{
			name:  "strip modifier",
			input: "{blue.strip}",
			want:  []string{"blue"},
		},
		{
			name:  "rgb modifier",
			input: "{red.rgb}",
			want:  []string{"red"},
		},
		{
			name:  "rgba with alpha",
			input: "{background.rgba:0.5}",
			want:  []string{"background"},
		},
		{
			name:  "yaru modifier",
			input: "{accent.yaru}",
			want:  []string{"accent"},
		},
		{
			name:  "multiple variables",
			input: "bg={background} fg={foreground} accent={accent}",
			want:  []string{"accent", "background", "foreground"},
		},
		{
			name:  "deduplication",
			input: "{red} and also {red.strip} and {red.rgb}",
			want:  []string{"red"},
		},
		{
			name:  "mixed modifiers",
			input: "rgb({blue.strip}) rgba({green.rgba:0.3}) {yellow}",
			want:  []string{"blue", "green", "yellow"},
		},
		{
			name:  "no variables",
			input: "nothing here $notAVar",
			want:  nil,
		},
		{
			name:  "hyprland style",
			input: "$activeBorderColor = rgb({blue.strip})\ngeneral {\n    col.active_border = $activeBorderColor\n}",
			want:  []string{"blue"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractVariableNames(tt.input)
			sort.Strings(got)
			sort.Strings(tt.want)

			if len(got) != len(tt.want) {
				t.Errorf("ExtractVariableNames() = %v, want %v", got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("ExtractVariableNames() = %v, want %v", got, tt.want)
					return
				}
			}
		})
	}
}

func TestRecomputeDerived(t *testing.T) {
	// Start with a base variable set
	vars := map[string]string{
		"background":           "#1e1e2e",
		"foreground":           "#cdd6f4",
		"red":                  "#f38ba8",
		"magenta":              "#cba6f7",
		"bright_black":         "#45475a",
		"bright_magenta":       "#cba6f7",
		"selection_background": "#45475a",
	}
	// Simulate BuildVariables setting initial derived values
	vars["bg"] = vars["background"]
	vars["fg"] = vars["foreground"]

	t.Run("override background propagates to bg and dark_bg", func(t *testing.T) {
		merged := make(map[string]string, len(vars))
		for k, v := range vars {
			merged[k] = v
		}
		merged["background"] = "#ff0000" // override
		overrides := map[string]string{"background": "#ff0000"}

		RecomputeDerived(merged, overrides)

		if merged["bg"] != "#ff0000" {
			t.Errorf("bg = %s, want #ff0000", merged["bg"])
		}
		if !strings.HasPrefix(merged["dark_bg"], "#") {
			t.Errorf("dark_bg should be computed, got %s", merged["dark_bg"])
		}
		if merged["dark_bg"] == "" {
			t.Error("dark_bg should not be empty")
		}
	})

	t.Run("explicit override of derived var is preserved", func(t *testing.T) {
		merged := make(map[string]string, len(vars))
		for k, v := range vars {
			merged[k] = v
		}
		merged["background"] = "#ff0000"
		merged["dark_bg"] = "#00ff00" // explicit override
		overrides := map[string]string{
			"background": "#ff0000",
			"dark_bg":    "#00ff00",
		}

		RecomputeDerived(merged, overrides)

		// dark_bg was explicitly overridden, should NOT be recomputed
		if merged["dark_bg"] != "#00ff00" {
			t.Errorf("dark_bg = %s, want #00ff00 (explicit override)", merged["dark_bg"])
		}
		// bg was NOT explicitly overridden, should be recomputed from background
		if merged["bg"] != "#ff0000" {
			t.Errorf("bg = %s, want #ff0000 (derived from background)", merged["bg"])
		}
	})
}
