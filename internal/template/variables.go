package template

import (
	"fmt"

	"aether/internal/color"
)

// ColorRoles holds the semantic color assignments used for template variable
// substitution. Each field maps to a template variable of the same name.
type ColorRoles struct {
	Background          string `json:"background"`
	Foreground          string `json:"foreground"`
	Black               string `json:"black"`
	Red                 string `json:"red"`
	Green               string `json:"green"`
	Yellow              string `json:"yellow"`
	Blue                string `json:"blue"`
	Magenta             string `json:"magenta"`
	Cyan                string `json:"cyan"`
	White               string `json:"white"`
	BrightBlack         string `json:"bright_black"`
	BrightRed           string `json:"bright_red"`
	BrightGreen         string `json:"bright_green"`
	BrightYellow        string `json:"bright_yellow"`
	BrightBlue          string `json:"bright_blue"`
	BrightMagenta       string `json:"bright_magenta"`
	BrightCyan          string `json:"bright_cyan"`
	BrightWhite         string `json:"bright_white"`
	Accent              string `json:"accent"`
	Cursor              string `json:"cursor"`
	SelectionForeground string `json:"selection_foreground"`
	SelectionBackground string `json:"selection_background"`
}

// semanticOrder maps ANSI color indices 0-15 to semantic role names.
var semanticOrder = [16]string{
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
	"bright_black",
	"bright_red",
	"bright_green",
	"bright_yellow",
	"bright_blue",
	"bright_magenta",
	"bright_cyan",
	"bright_white",
}

// rolesMap returns a map of semantic name -> hex value from the given ColorRoles.
func rolesMap(roles ColorRoles) map[string]string {
	return map[string]string{
		"background":           roles.Background,
		"foreground":           roles.Foreground,
		"black":                roles.Black,
		"red":                  roles.Red,
		"green":                roles.Green,
		"yellow":               roles.Yellow,
		"blue":                 roles.Blue,
		"magenta":              roles.Magenta,
		"cyan":                 roles.Cyan,
		"white":                roles.White,
		"bright_black":         roles.BrightBlack,
		"bright_red":           roles.BrightRed,
		"bright_green":         roles.BrightGreen,
		"bright_yellow":        roles.BrightYellow,
		"bright_blue":          roles.BrightBlue,
		"bright_magenta":       roles.BrightMagenta,
		"bright_cyan":          roles.BrightCyan,
		"bright_white":         roles.BrightWhite,
		"accent":               roles.Accent,
		"cursor":               roles.Cursor,
		"selection_foreground": roles.SelectionForeground,
		"selection_background": roles.SelectionBackground,
	}
}

// BuildVariables creates the full template variable map from color roles.
// It includes: semantic names, color0-15 aliases, extended colors, and
// derived shade variables (dark_bg, lighter_bg, orange, brown, etc.).
func BuildVariables(roles ColorRoles, lightMode bool) map[string]string {
	vars := rolesMap(roles)

	// Ensure extended color defaults if empty
	if vars["accent"] == "" {
		vars["accent"] = vars["blue"]
	}
	if vars["cursor"] == "" {
		vars["cursor"] = vars["foreground"]
	}
	if vars["selection_foreground"] == "" {
		vars["selection_foreground"] = vars["background"]
	}
	if vars["selection_background"] == "" {
		vars["selection_background"] = vars["foreground"]
	}

	// Add color0-15 aliases (backwards compatibility with existing templates)
	for i, name := range semanticOrder {
		vars[fmt.Sprintf("color%d", i)] = vars[name]
	}

	// Theme type for VSCode and other templates
	if lightMode {
		vars["theme_type"] = "light"
	} else {
		vars["theme_type"] = "dark"
	}

	// Derived shade variables (matches omarchy-theme-set-templates)
	vars["bg"] = vars["background"]
	vars["fg"] = vars["foreground"]
	vars["dark_bg"] = color.DarkenRGB(vars["background"], 75)
	vars["darker_bg"] = color.DarkenRGB(vars["background"], 50)
	vars["lighter_bg"] = color.LightenRGB(vars["background"], 10)
	vars["dark_fg"] = color.DarkenRGB(vars["foreground"], 75)
	vars["light_fg"] = color.LightenRGB(vars["foreground"], 15)
	vars["bright_fg"] = color.LightenRGB(vars["foreground"], 25)
	vars["muted"] = vars["bright_black"]
	vars["purple"] = vars["magenta"]
	vars["bright_purple"] = vars["bright_magenta"]

	orange := color.LightenRGB(vars["red"], 15)
	vars["orange"] = orange
	vars["brown"] = color.DarkenRGB(orange, 60)
	vars["selection"] = vars["selection_background"]

	return vars
}

// RecomputeDerived recalculates alias and derived variables from the current
// base values in vars. Call this after applying per-app overrides so that
// overriding e.g. "background" also updates "bg", "dark_bg", etc.
// Variables that are explicitly present in overrides are preserved as-is.
func RecomputeDerived(vars map[string]string, overrides map[string]string) {
	set := func(key, value string) {
		if _, explicit := overrides[key]; !explicit {
			vars[key] = value
		}
	}

	set("bg", vars["background"])
	set("fg", vars["foreground"])
	set("dark_bg", color.DarkenRGB(vars["background"], 75))
	set("darker_bg", color.DarkenRGB(vars["background"], 50))
	set("lighter_bg", color.LightenRGB(vars["background"], 10))
	set("dark_fg", color.DarkenRGB(vars["foreground"], 75))
	set("light_fg", color.LightenRGB(vars["foreground"], 15))
	set("bright_fg", color.LightenRGB(vars["foreground"], 25))
	set("muted", vars["bright_black"])
	set("purple", vars["magenta"])
	set("bright_purple", vars["bright_magenta"])
	orange := color.LightenRGB(vars["red"], 15)
	set("orange", orange)
	set("brown", color.DarkenRGB(orange, 60))
	set("selection", vars["selection_background"])

	for i, name := range semanticOrder {
		key := fmt.Sprintf("color%d", i)
		set(key, vars[name])
	}
}
