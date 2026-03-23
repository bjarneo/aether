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

func TestReplaceVariable(t *testing.T) {
	tests := []struct {
		name    string
		content string
		key     string
		value   string
		want    string
	}{
		{
			name:    "plain hex replacement",
			content: "color = {background}",
			key:     "background",
			value:   "#1e1e2e",
			want:    "color = #1e1e2e",
		},
		{
			name:    "strip modifier removes hash",
			content: "rgb({blue.strip})",
			key:     "blue",
			value:   "#89b4fa",
			want:    "rgb(89b4fa)",
		},
		{
			name:    "strip on value without hash",
			content: "{key.strip}",
			key:     "key",
			value:   "nohash",
			want:    "nohash",
		},
		{
			name:    "rgb modifier converts to decimal",
			content: "color: {red.rgb};",
			key:     "red",
			value:   "#f38ba8",
			want:    "color: 243,139,168;",
		},
		{
			name:    "rgb pure black",
			content: "{bg.rgb}",
			key:     "bg",
			value:   "#000000",
			want:    "0,0,0",
		},
		{
			name:    "rgb pure white",
			content: "{fg.rgb}",
			key:     "fg",
			value:   "#ffffff",
			want:    "255,255,255",
		},
		{
			name:    "rgb non-hex value passes through",
			content: "{key.rgb}",
			key:     "key",
			value:   "notahex",
			want:    "notahex",
		},
		{
			name:    "rgba default alpha",
			content: "{blue.rgba}",
			key:     "blue",
			value:   "#89b4fa",
			want:    "rgba(137, 180, 250, 1)",
		},
		{
			name:    "rgba custom alpha",
			content: "{blue.rgba:0.5}",
			key:     "blue",
			value:   "#89b4fa",
			want:    "rgba(137, 180, 250, 0.5)",
		},
		{
			name:    "rgba zero alpha",
			content: "{bg.rgba:0}",
			key:     "bg",
			value:   "#1e1e2e",
			want:    "rgba(30, 30, 46, 0)",
		},
		{
			name:    "rgba non-hex passes through",
			content: "{key.rgba:0.5}",
			key:     "key",
			value:   "notahex",
			want:    "notahex",
		},
		{
			name:    "yaru modifier blue",
			content: "icon-theme={accent.yaru}",
			key:     "accent",
			value:   "#89b4fa", // blue hue (~217°)
			want:    "icon-theme=Yaru-blue",
		},
		{
			name:    "yaru modifier red",
			content: "{accent.yaru}",
			key:     "accent",
			value:   "#ff0000",
			want:    "Yaru-red",
		},
		{
			name:    "yaru non-hex passes through",
			content: "{key.yaru}",
			key:     "key",
			value:   "notahex",
			want:    "notahex",
		},
		{
			name:    "multiple occurrences of same variable",
			content: "{bg} and {bg} again",
			key:     "bg",
			value:   "#000000",
			want:    "#000000 and #000000 again",
		},
		{
			name:    "all modifiers in one template",
			content: "{c} {c.strip} {c.rgb} {c.rgba} {c.rgba:0.3} {c.yaru}",
			key:     "c",
			value:   "#00ff00", // green hue (120°)
			want:    "#00ff00 00ff00 0,255,0 rgba(0, 255, 0, 1) rgba(0, 255, 0, 0.3) Yaru-sage",
		},
		{
			name:    "unrelated variables are untouched",
			content: "{other} stays, {mine} changes",
			key:     "mine",
			value:   "#aabbcc",
			want:    "{other} stays, #aabbcc changes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ReplaceVariable(tt.content, tt.key, tt.value)
			if got != tt.want {
				t.Errorf("ReplaceVariable() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestProcessTemplate(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		variables map[string]string
		want      string
	}{
		{
			name:    "single variable",
			content: "bg={background}",
			variables: map[string]string{
				"background": "#1e1e2e",
			},
			want: "bg=#1e1e2e",
		},
		{
			name:    "multiple variables",
			content: "bg={background}\nfg={foreground}\naccent={accent}",
			variables: map[string]string{
				"background": "#1e1e2e",
				"foreground": "#cdd6f4",
				"accent":     "#89b4fa",
			},
			want: "bg=#1e1e2e\nfg=#cdd6f4\naccent=#89b4fa",
		},
		{
			name:    "mixed modifiers across variables",
			content: "border=rgb({blue.strip})\noverlay={background.rgba:0.8}\nicons={accent.yaru}",
			variables: map[string]string{
				"blue":       "#89b4fa",
				"background": "#1e1e2e",
				"accent":     "#89b4fa",
			},
			want: "border=rgb(89b4fa)\noverlay=rgba(30, 30, 46, 0.8)\nicons=Yaru-blue",
		},
		{
			name:      "no variables in template",
			content:   "static content\nno placeholders here",
			variables: map[string]string{"background": "#000"},
			want:      "static content\nno placeholders here",
		},
		{
			name:      "empty template",
			content:   "",
			variables: map[string]string{"background": "#000"},
			want:      "",
		},
		{
			name:      "empty variables",
			content:   "{background}",
			variables: map[string]string{},
			want:      "{background}",
		},
		{
			name:    "real-world cava template",
			content: "[color]\nbackground = 'default'\nforeground = '{magenta}'\ngradient = 1\ngradient_color_1 = '{blue}'\ngradient_color_2 = '{magenta}'\ngradient_color_3 = '{cyan}'",
			variables: map[string]string{
				"magenta": "#cba6f7",
				"blue":    "#89b4fa",
				"cyan":    "#94e2d5",
			},
			want: "[color]\nbackground = 'default'\nforeground = '#cba6f7'\ngradient = 1\ngradient_color_1 = '#89b4fa'\ngradient_color_2 = '#cba6f7'\ngradient_color_3 = '#94e2d5'",
		},
		{
			name:    "real-world hyprland template",
			content: "$activeBorderColor = rgb({blue.strip})\ngeneral {\n    col.active_border = $activeBorderColor\n}",
			variables: map[string]string{
				"blue": "#89b4fa",
			},
			want: "$activeBorderColor = rgb(89b4fa)\ngeneral {\n    col.active_border = $activeBorderColor\n}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ProcessTemplate(tt.content, tt.variables)
			if got != tt.want {
				t.Errorf("ProcessTemplate() =\n%s\nwant:\n%s", got, tt.want)
			}
		})
	}
}

func TestBuildVariables(t *testing.T) {
	roles := ColorRoles{
		Background:          "#1e1e2e",
		Foreground:          "#cdd6f4",
		Black:               "#45475a",
		Red:                 "#f38ba8",
		Green:               "#a6e3a1",
		Yellow:              "#f9e2af",
		Blue:                "#89b4fa",
		Magenta:             "#cba6f7",
		Cyan:                "#94e2d5",
		White:               "#bac2de",
		BrightBlack:         "#585b70",
		BrightRed:           "#f38ba8",
		BrightGreen:         "#a6e3a1",
		BrightYellow:        "#f9e2af",
		BrightBlue:          "#89b4fa",
		BrightMagenta:       "#cba6f7",
		BrightCyan:          "#94e2d5",
		BrightWhite:         "#a6adc8",
		Accent:              "#89b4fa",
		Cursor:              "#cdd6f4",
		SelectionForeground: "#1e1e2e",
		SelectionBackground: "#585b70",
	}

	t.Run("dark mode", func(t *testing.T) {
		vars := BuildVariables(roles, false)

		// Check base colors
		if vars["background"] != "#1e1e2e" {
			t.Errorf("background = %s, want #1e1e2e", vars["background"])
		}
		if vars["foreground"] != "#cdd6f4" {
			t.Errorf("foreground = %s, want #cdd6f4", vars["foreground"])
		}

		// Check ANSI aliases
		if vars["color0"] != "#45475a" {
			t.Errorf("color0 = %s, want #45475a", vars["color0"])
		}
		if vars["color1"] != "#f38ba8" {
			t.Errorf("color1 = %s, want #f38ba8", vars["color1"])
		}

		// Check derived variables exist and are hex
		for _, key := range []string{"bg", "fg", "dark_bg", "darker_bg", "lighter_bg", "dark_fg", "light_fg", "bright_fg", "orange", "brown"} {
			if v := vars[key]; v == "" || v[0] != '#' {
				t.Errorf("%s = %q, expected non-empty hex", key, v)
			}
		}

		// Check aliases
		if vars["bg"] != vars["background"] {
			t.Errorf("bg = %s, want %s (same as background)", vars["bg"], vars["background"])
		}
		if vars["muted"] != vars["bright_black"] {
			t.Errorf("muted = %s, want %s (same as bright_black)", vars["muted"], vars["bright_black"])
		}
		if vars["purple"] != vars["magenta"] {
			t.Errorf("purple = %s, want %s (same as magenta)", vars["purple"], vars["magenta"])
		}

		// Check theme type
		if vars["theme_type"] != "dark" {
			t.Errorf("theme_type = %s, want dark", vars["theme_type"])
		}
	})

	t.Run("light mode", func(t *testing.T) {
		vars := BuildVariables(roles, true)
		if vars["theme_type"] != "light" {
			t.Errorf("theme_type = %s, want light", vars["theme_type"])
		}
	})

	t.Run("defaults for empty extended colors", func(t *testing.T) {
		emptyRoles := ColorRoles{
			Background: "#1e1e2e",
			Foreground: "#cdd6f4",
			Blue:       "#89b4fa",
		}
		vars := BuildVariables(emptyRoles, false)

		if vars["accent"] != "#89b4fa" {
			t.Errorf("accent = %s, want #89b4fa (default to blue)", vars["accent"])
		}
		if vars["cursor"] != "#cdd6f4" {
			t.Errorf("cursor = %s, want #cdd6f4 (default to foreground)", vars["cursor"])
		}
		if vars["selection_foreground"] != "#1e1e2e" {
			t.Errorf("selection_foreground = %s, want #1e1e2e (default to background)", vars["selection_foreground"])
		}
		if vars["selection_background"] != "#cdd6f4" {
			t.Errorf("selection_background = %s, want #cdd6f4 (default to foreground)", vars["selection_background"])
		}
	})
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
