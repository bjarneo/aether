package omarchy

import (
	"strings"
)

// slotChains lists, for each ANSI slot 0-15, the colors.toml keys to try in
// priority order. The chains let a single parser reconstruct a full palette
// from any flavour of colors.toml and fall back across them:
//
//   - legacy ANSI: color0 … color15 (what Aether itself writes) win first
//   - standard semantic: black, red, …, bright_white
//   - omarchy semantic: bg, fg, purple, muted, light_fg, bright_fg, dark_fg …
//
// omarchy renames a few slots: slot 5 is "purple" (ANSI magenta), slot 8 is
// "muted" (ANSI bright black), and the foreground anchor is "foreground"
// (its "fg" key is a dimmed variant, so it only feeds slot 7 as a last resort).
var slotChains = [16][]string{
	0:  {"color0", "bg", "background", "black"},
	1:  {"color1", "red"},
	2:  {"color2", "green"},
	3:  {"color3", "yellow"},
	4:  {"color4", "blue"},
	5:  {"color5", "purple", "magenta"},
	6:  {"color6", "cyan"},
	7:  {"color7", "foreground", "light_fg", "white", "fg"},
	8:  {"color8", "bright_black", "muted", "dark_fg"},
	9:  {"color9", "bright_red", "red"},
	10: {"color10", "bright_green", "green"},
	11: {"color11", "bright_yellow", "yellow"},
	12: {"color12", "bright_blue", "blue"},
	13: {"color13", "bright_purple", "bright_magenta", "purple", "magenta"},
	14: {"color14", "bright_cyan", "cyan"},
	15: {"color15", "bright_fg", "bright_white", "foreground", "light_fg"},
}

// extendedColorKeys are the non-ANSI roles an omarchy theme defines explicitly
// (separate from the 16 palette slots). Preserving them on import keeps an
// imported theme faithful instead of re-deriving accent/cursor/selection.
var extendedColorKeys = []string{
	"accent",
	"cursor",
	"selection_foreground",
	"selection_background",
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

		// Strip inline comments, then surrounding quotes.
		if idx := strings.Index(val, " #"); idx >= 0 {
			val = strings.TrimSpace(val[:idx])
		}
		val = strings.Trim(val, `"'`)
		if val == "" {
			continue
		}
		kv[key] = val
	}
	return kv
}

// resolveMode reads the light/dark mode from a parsed colors.toml map. It
// returns "light"/"dark" only when the file declares it (via `mode` or the
// legacy `light_mode` boolean); "" means the file was silent.
func resolveMode(kv map[string]string) string {
	switch strings.ToLower(kv["mode"]) {
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
// red, …, bright_white) and omarchy's semantic form (bg, fg, purple, muted,
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
	fg = first("foreground", "light_fg", "white", "color7", "fg")

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

	extended = make(map[string]string)
	for _, k := range extendedColorKeys {
		if v := kv[k]; v != "" {
			extended[k] = v
		}
	}

	return
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
