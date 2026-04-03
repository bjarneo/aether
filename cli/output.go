package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"aether/internal/blueprint"
	"aether/internal/color"
)

// stripJSON removes the --json flag from args and returns whether it was present.
func stripJSON(args []string) (bool, []string) {
	return hasFlag(args, "--json")
}

// printJSON marshals v as indented JSON to stdout and returns exit code 0.
func printJSON(v interface{}) int {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to marshal JSON: %v\n", err)
		return 1
	}
	fmt.Println(string(data))
	return 0
}

// printErrorJSON prints {"error": msg} to stdout and returns exit code 1.
func printErrorJSON(msg string) int {
	data, _ := json.Marshal(map[string]string{"error": msg})
	fmt.Println(string(data))
	return 1
}

// normalizeHex ensures a color string has a leading # prefix.
func normalizeHex(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "#") {
		s = "#" + s
	}
	return s
}

// parsePaletteArg tries to parse s as a JSON array of hex strings.
// If that fails, treats s as a blueprint name and loads its colors.
func parsePaletteArg(s string) ([]string, error) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "[") {
		var colors []string
		if err := json.Unmarshal([]byte(s), &colors); err != nil {
			return nil, fmt.Errorf("invalid JSON array: %w", err)
		}
		return colors, nil
	}
	// Treat as blueprint name
	svc := blueprint.NewService()
	bp, err := svc.FindByName(s)
	if err != nil {
		return nil, err
	}
	if bp == nil {
		return nil, fmt.Errorf("blueprint %q not found", s)
	}
	return bp.Palette.Colors, nil
}

// paletteNames maps ANSI color indices 0-15 to their semantic names.
var paletteNames = [16]string{
	"black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
	"bright_black", "bright_red", "bright_green", "bright_yellow",
	"bright_blue", "bright_magenta", "bright_cyan", "bright_white",
}

// parseFlagNames returns which --flag names are present in args.
func parseFlagNames(args []string) map[string]bool {
	present := make(map[string]bool)
	for i, arg := range args {
		if strings.HasPrefix(arg, "--") && i+1 < len(args) {
			present[arg] = true
		}
	}
	return present
}

// parseAdjustmentFlags extracts all 12 adjustment flags from args.
func parseAdjustmentFlags(args []string) (color.Adjustments, []string) {
	adj := color.DefaultAdjustments()

	flags := []struct {
		name string
		dest *float64
	}{
		{"--vibrance", &adj.Vibrance},
		{"--saturation", &adj.Saturation},
		{"--contrast", &adj.Contrast},
		{"--brightness", &adj.Brightness},
		{"--shadows", &adj.Shadows},
		{"--highlights", &adj.Highlights},
		{"--hue-shift", &adj.HueShift},
		{"--temperature", &adj.Temperature},
		{"--tint", &adj.Tint},
		{"--gamma", &adj.Gamma},
		{"--black-point", &adj.BlackPoint},
		{"--white-point", &adj.WhitePoint},
	}

	for _, f := range flags {
		val, remaining := parseFlag(args, f.name)
		args = remaining
		if val != "" {
			if v, err := strconv.ParseFloat(val, 64); err == nil {
				*f.dest = v
			}
		}
	}

	return adj, args
}
