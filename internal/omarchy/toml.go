package omarchy

import (
	"fmt"
	"regexp"
	"strings"
)

// slotChains lists the native semantic key before legacy ANSI aliases. This
// matches Omarchy's own resolver when a theme contains both forms.
var slotChains = [16][]string{
	0:  {"background", "bg", "color0", "black"},
	1:  {"red", "color1"},
	2:  {"green", "color2"},
	3:  {"yellow", "color3"},
	4:  {"blue", "color4"},
	5:  {"magenta", "purple", "color5"},
	6:  {"cyan", "color6"},
	7:  {"foreground", "fg", "color7", "white", "light_foreground", "light_fg"},
	8:  {"muted", "color8", "bright_black", "dark_foreground", "dark_fg"},
	9:  {"bright_red", "color9", "red"},
	10: {"bright_green", "color10", "green"},
	11: {"bright_yellow", "color11", "yellow"},
	12: {"bright_blue", "color12", "blue"},
	13: {"bright_magenta", "bright_purple", "color13", "magenta", "purple"},
	14: {"bright_cyan", "color14", "cyan"},
	15: {"bright_foreground", "bright_fg", "color15", "bright_white", "foreground", "light_foreground", "light_fg"},
}

// editableColorKeys maps native palette names to Aether's internal template
// names. These values stay editable and are preserved when a theme is saved.
var editableColorKeys = map[string]string{
	"accent":               "accent",
	"cursor":               "cursor",
	"selection":            "selection",
	"selection_foreground": "selection_foreground",
	"selection_background": "selection_background",
	"muted":                "muted",
	"dark_background":      "dark_bg",
	"dark_bg":              "dark_bg",
	"darker_background":    "darker_bg",
	"darker_bg":            "darker_bg",
	"lighter_background":   "lighter_bg",
	"lighter_bg":           "lighter_bg",
	"dark_foreground":      "dark_fg",
	"dark_fg":              "dark_fg",
	"light_foreground":     "light_fg",
	"light_fg":             "light_fg",
	"bright_foreground":    "bright_fg",
	"bright_fg":            "bright_fg",
	"orange":               "orange",
	"brown":                "brown",
}

var nativePaletteKeys = map[string]bool{
	"mode": true, "theme_type": true, "light_mode": true,
	"background": true, "bg": true, "foreground": true, "fg": true,
	"black": true, "red": true, "green": true, "yellow": true,
	"blue": true, "magenta": true, "purple": true, "cyan": true, "white": true,
	"bright_black": true, "bright_red": true, "bright_green": true,
	"bright_yellow": true, "bright_blue": true, "bright_magenta": true, "bright_purple": true,
	"bright_cyan": true, "bright_white": true,
}

var ansiColorKeyPattern = regexp.MustCompile(`^color(?:[0-9]|1[0-5])$`)
var nativeColorKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
var nativeColorValuePattern = regexp.MustCompile(`^[A-Za-z0-9#(),.%+/_ -]+$`)

// ValidateNativeColors rejects malformed or Aether-owned native color keys.
func ValidateNativeColors(colors map[string]string) error {
	for key, value := range colors {
		if !nativeColorKeyPattern.MatchString(key) {
			return fmt.Errorf("native Omarchy color key %q is invalid", key)
		}
		if nativePaletteKeys[key] || ansiColorKeyPattern.MatchString(key) {
			return fmt.Errorf("native Omarchy color key %q is reserved", key)
		}
		if _, editable := editableColorKeys[key]; editable {
			return fmt.Errorf("native Omarchy color key %q is reserved", key)
		}
		if value == "" || !nativeColorValuePattern.MatchString(value) {
			return fmt.Errorf("native Omarchy color %q has an invalid value", key)
		}
	}
	return nil
}

// ParseColorsKV extracts key="value" pairs from a colors.toml, stripping
// inline comments and surrounding quotes. Empty values are dropped. It is the
// shared low-level scanner used by both ParseColorsTomlFull and the theme
// watcher so the two never disagree on how a colors.toml line is read.
func ParseColorsKV(content string) map[string]string {
	kv := make(map[string]string)
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)

		// Strip comments outside quoted values, then surrounding quotes.
		val = stripInlineComment(val)
		val = strings.Trim(val, `"'`)
		if val == "" {
			continue
		}
		kv[key] = val
	}
	return kv
}

func stripInlineComment(value string) string {
	var quote byte
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case '\'', '"':
			if quote == 0 {
				quote = value[i]
			} else if quote == value[i] && (i == 0 || value[i-1] != '\\') {
				quote = 0
			}
		case '#':
			if quote == 0 && i > 0 && (value[i-1] == ' ' || value[i-1] == '\t') {
				return strings.TrimSpace(value[:i])
			}
		}
	}
	return value
}

// resolveMode reads the light/dark mode from a parsed colors.toml map. It
// returns "light"/"dark" only when the file declares it (via `mode` or the
// legacy `light_mode` boolean); "" means the file was silent.
func resolveMode(kv map[string]string) string {
	mode := kv["mode"]
	if mode == "" {
		mode = kv["theme_type"]
	}
	switch strings.ToLower(mode) {
	case "light":
		return "light"
	case "dark":
		return "dark"
	}
	switch strings.ToLower(kv["light_mode"]) {
	case "true", "1", "yes":
		return "light"
	case "false", "0", "no":
		return "dark"
	}
	return ""
}

// ParseColorsToml parses a colors.toml palette into a 16-slot ANSI array plus
// the background/foreground anchors and the declared light/dark mode. It is a
// thin wrapper over ParseColorsTomlFull for callers that don't need the
// extended (accent/cursor/selection) colors.
func ParseColorsToml(content string) (colors [16]string, bg, fg, mode string) {
	colors, bg, fg, mode, _ = ParseColorsTomlFull(content)
	return
}

// ParseColorsTomlFull parses a colors.toml into the 16-slot ANSI palette, the
// background/foreground anchors, the declared light/dark mode, and the
// explicit extended colors (accent, cursor, selection_foreground,
// selection_background) when present.
//
// It accepts the legacy color0-15 form, the standard semantic form (black,
// red, …, bright_white) and omarchy's semantic form (bg, fg, muted,
// the fg/bg shade ramp), falling back across them per slot via slotChains so a
// colorN-free omarchy theme still reconstructs a full palette.
//
// The `mode` return is "light" / "dark" when the file declares it; empty when
// silent, so callers can distinguish "publisher didn't say" from an explicit
// setting.
func ParseColorsTomlFull(content string) (colors [16]string, bg, fg, mode string, extended map[string]string) {
	kv := ParseColorsKV(content)

	// first returns the first non-empty value among the given keys.
	first := func(keys ...string) string {
		for _, k := range keys {
			if v := kv[k]; v != "" {
				return v
			}
		}
		return ""
	}

	mode = resolveMode(kv)

	bg = first("background", "bg", "color0", "black")
	fg = first("foreground", "fg", "color7", "white", "light_foreground", "light_fg")

	for i, chain := range slotChains {
		colors[i] = first(chain...)
	}

	// Last-resort anchors so the bg/fg slots are never blank when bg/fg known.
	if colors[0] == "" {
		colors[0] = bg
	}
	if colors[7] == "" {
		colors[7] = fg
	}

	extended = make(map[string]string, len(editableColorKeys))
	for native, internal := range editableColorKeys {
		if v := kv[native]; v != "" && extended[internal] == "" {
			extended[internal] = v
		}
	}
	// Canonical names win over compatibility aliases when both are present.
	for native, internal := range map[string]string{
		"dark_background":    "dark_bg",
		"darker_background":  "darker_bg",
		"lighter_background": "lighter_bg",
		"dark_foreground":    "dark_fg",
		"light_foreground":   "light_fg",
		"bright_foreground":  "bright_fg",
	} {
		if v := kv[native]; v != "" {
			extended[internal] = v
		}
	}
	if extended["selection_background"] == "" {
		extended["selection_background"] = extended["selection"]
	}
	if extended["cursor"] == "" {
		extended["cursor"] = first("bright_foreground", "bright_fg")
	}

	return
}

// ParseNativeColors returns valid theme-specific keys that Aether does not
// edit directly. Keeping them separate avoids feeding gradients and other
// non-hex values through the color-adjustment pipeline.
func ParseNativeColors(content string) map[string]string {
	kv := ParseColorsKV(content)
	native := make(map[string]string)
	for key, value := range kv {
		if nativePaletteKeys[key] || ansiColorKeyPattern.MatchString(key) {
			continue
		}
		if _, editable := editableColorKeys[key]; editable {
			continue
		}
		native[key] = value
	}
	return native
}

// ParseKittyConf parses a kitty.conf for color definitions.
func ParseKittyConf(content string) (colors [16]string, bg, fg string) {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key, val := fields[0], fields[1]

		switch key {
		case "background":
			bg = val
		case "foreground":
			fg = val
		case "color0":
			colors[0] = val
		case "color1":
			colors[1] = val
		case "color2":
			colors[2] = val
		case "color3":
			colors[3] = val
		case "color4":
			colors[4] = val
		case "color5":
			colors[5] = val
		case "color6":
			colors[6] = val
		case "color7":
			colors[7] = val
		case "color8":
			colors[8] = val
		case "color9":
			colors[9] = val
		case "color10":
			colors[10] = val
		case "color11":
			colors[11] = val
		case "color12":
			colors[12] = val
		case "color13":
			colors[13] = val
		case "color14":
			colors[14] = val
		case "color15":
			colors[15] = val
		}
	}
	return
}
