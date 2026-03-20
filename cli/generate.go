package cli

import (
	"embed"
	"fmt"
	"os"

	"aether/internal/extraction"
	"aether/internal/theme"
)

func runGenerate(args []string, templatesFS embed.FS) int {
	// Parse flags
	mode, args := parseFlag(args, "--extract-mode")
	if mode == "" {
		mode = "normal"
	}
	lightMode, args := hasFlag(args, "--light-mode")
	noApply, args := hasFlag(args, "--no-apply")
	outputPath, args := parseFlag(args, "--output")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: Wallpaper path is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --generate <wallpaper> [--extract-mode <mode>] [--light-mode] [--no-apply] [--output <path>]")
		return 1
	}

	wallpaperPath := args[0]

	// Validate mode
	if !validModes[mode] {
		fmt.Fprintf(os.Stderr, "Error: Invalid extraction mode: %s\n", mode)
		fmt.Fprintf(os.Stderr, "Valid modes: normal, monochromatic, analogous, pastel, material, colorful, muted, bright\n")
		return 1
	}

	// Expand paths
	wallpaperPath = expandHome(wallpaperPath)
	if outputPath != "" {
		outputPath = expandHome(outputPath)
	}

	// Validate file exists
	if _, err := os.Stat(wallpaperPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: Wallpaper file not found: %s\n", wallpaperPath)
		return 1
	}

	// Build status message
	msg := fmt.Sprintf("Extracting colors from: %s", wallpaperPath)
	var details []string
	if mode != "normal" {
		details = append(details, mode)
	}
	if lightMode {
		details = append(details, "light mode")
	}
	if noApply {
		details = append(details, "generate only")
	}
	if len(details) > 0 {
		msg += fmt.Sprintf(" (%s)", joinStrings(details, ", "))
	}
	fmt.Println(msg)

	// Extract colors
	palette, err := extraction.ExtractColors(wallpaperPath, lightMode, mode)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to extract colors: %v\n", err)
		return 1
	}
	fmt.Println("Extracted 16 colors successfully")

	// Map colors to roles
	colorRoles := MapColorsToRoles(palette)

	// Create writer
	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:       palette,
		WallpaperPath: wallpaperPath,
		LightMode:     lightMode,
		ColorRoles:    colorRoles,
	}

	settings := theme.Settings{}

	if noApply {
		fmt.Println("Generating theme files...")
		if err := writer.GenerateOnly(state, settings, outputPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: Failed to generate theme: %v\n", err)
			return 1
		}
		fmt.Println("Theme files generated successfully")
	} else {
		fmt.Println("Applying theme...")
		result, err := writer.ApplyTheme(state, settings)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: Failed to apply theme: %v\n", err)
			return 1
		}
		if result.Success {
			fmt.Println("Theme applied successfully")
		}
	}

	return 0
}

func joinStrings(s []string, sep string) string {
	result := ""
	for i, v := range s {
		if i > 0 {
			result += sep
		}
		result += v
	}
	return result
}
