package cli

import (
	"embed"
	"fmt"
	"os"
	"strings"

	"aether/internal/blueprint"
	"aether/internal/theme"
)

func runImportBlueprint(args []string, templatesFS embed.FS) int {
	autoApply, args := hasFlag(args, "--auto-apply")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: Blueprint source (URL or file path) is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --import-blueprint <url|path> [--auto-apply]")
		return 1
	}

	source := args[0]
	var bp *blueprint.Blueprint
	var err error

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		fmt.Printf("Downloading blueprint from: %s\n", source)
		bp, err = blueprint.ImportFromURL(source)
	} else {
		source = expandHome(source)
		fmt.Printf("Importing blueprint from: %s\n", source)
		bp, err = blueprint.ImportJSON(source)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	svc := blueprint.NewService()
	if !svc.Validate(bp) {
		fmt.Fprintln(os.Stderr, "Error: Blueprint has invalid structure")
		return 1
	}

	path, err := blueprint.SaveImported(bp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error saving blueprint: %v\n", err)
		return 1
	}

	fmt.Printf("Imported blueprint: %s\n", bp.Name)
	fmt.Printf("  Saved to: %s\n", path)

	if autoApply {
		fmt.Println("Applying imported blueprint...")
		return runApplyBlueprint([]string{bp.Name}, templatesFS)
	}
	return 0
}

func runImportBase16(args []string, templatesFS embed.FS) int {
	wallpaperPath, args := parseFlag(args, "--wallpaper")
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: Base16 file path is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --import-base16 <file.yaml> [--wallpaper <path>] [--light-mode]")
		return 1
	}

	filePath := expandHome(args[0])
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: File not found: %s\n", filePath)
		return 1
	}

	fmt.Printf("Importing Base16 scheme from: %s\n", filePath)
	bp, err := blueprint.ImportBase16(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	fmt.Printf("Parsed scheme: %s\n", bp.Name)

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}

	colorRoles := MapColorsToRoles(palette)
	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:       palette,
		WallpaperPath: expandHome(wallpaperPath),
		LightMode:     lightMode,
		ColorRoles:    colorRoles,
	}

	fmt.Println("Applying theme...")
	result, err := writer.ApplyTheme(state, theme.Settings{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	if result.Success {
		fmt.Println("Theme applied successfully")
	}
	return 0
}

func runImportColorsToml(args []string, templatesFS embed.FS) int {
	wallpaperPath, args := parseFlag(args, "--wallpaper")
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: colors.toml file path is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --import-colors-toml <file.toml> [--wallpaper <path>] [--light-mode]")
		return 1
	}

	filePath := expandHome(args[0])
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: File not found: %s\n", filePath)
		return 1
	}

	fmt.Printf("Importing colors.toml from: %s\n", filePath)
	bp, err := blueprint.ImportColorsToml(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	fmt.Printf("Parsed %d colors\n", len(bp.Palette.Colors))

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}

	colorRoles := MapColorsToRoles(palette)
	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:       palette,
		WallpaperPath: expandHome(wallpaperPath),
		LightMode:     lightMode,
		ColorRoles:    colorRoles,
	}

	fmt.Println("Applying theme...")
	result, err := writer.ApplyTheme(state, theme.Settings{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	if result.Success {
		fmt.Println("Theme applied successfully")
	}
	return 0
}
