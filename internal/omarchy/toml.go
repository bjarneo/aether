package omarchy

import (
	"strings"
)

// semanticToIndex maps ANSI color names to their index.
var semanticToIndex = map[string]int{
	"black":          0,
	"red":            1,
	"green":          2,
	"yellow":         3,
	"blue":           4,
	"magenta":        5,
	"cyan":           6,
	"white":          7,
	"bright_black":   8,
	"bright_red":     9,
	"bright_green":   10,
	"bright_yellow":  11,
	"bright_blue":    12,
	"bright_magenta": 13,
	"bright_cyan":    14,
	"bright_white":   15,
}

// ParseColorsToml parses an Aether-generated colors.toml.
// Supports both color0-15 and semantic name (black, red, etc.) formats.
func ParseColorsToml(content string) (colors [16]string, bg, fg string) {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Strip inline comments
		if idx := strings.Index(val, " #"); idx >= 0 {
			val = strings.TrimSpace(val[:idx])
		}
		val = strings.Trim(val, `"'`)

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
		default:
			// Try semantic names (black, red, green, etc.)
			if idx, ok := semanticToIndex[key]; ok {
				// Only set if not already set by color0-15
				if colors[idx] == "" {
					colors[idx] = val
				}
			}
		}
	}

	// Fill background/foreground into palette if color0/color7 are empty
	if colors[0] == "" && bg != "" {
		colors[0] = bg
	}
	if colors[7] == "" && fg != "" {
		colors[7] = fg
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
