package cli

import (
	"embed"
	"fmt"
	"os"
	"strings"

	"aether/internal/blueprint"
	"aether/internal/theme"
	"aether/internal/wallpaper"
)

// isURL reports whether the source string is an http or https URL.
func isURL(s string) bool {
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

// resolveWallpaperArg returns a local wallpaper path. Empty inputs pass
// through; URLs are downloaded into the web-imports cache; local paths get
// ~ expanded.
func resolveWallpaperArg(arg string) (string, error) {
	if arg == "" {
		return "", nil
	}
	if isURL(arg) {
		fmt.Printf("Downloading wallpaper from: %s\n", arg)
		return wallpaper.DownloadToCache(arg)
	}
	return expandHome(arg), nil
}

// applyImportedTheme builds theme state from an imported blueprint and applies
// it system-wide. The blueprint's own mode wins unless forceLight overrides it;
// extended colors are set before SetPalette so buildColorRoles keeps the
// imported accent/cursor/selection rather than re-deriving them.
func applyImportedTheme(templatesFS embed.FS, bp *blueprint.Blueprint, palette [16]string, wallpaperPath string, forceLight bool) (*theme.ApplyResult, error) {
	writer := theme.NewWriter(templatesFS, "templates")
	state := theme.NewThemeState()
	state.WallpaperPath = wallpaperPath
	state.LightMode = forceLight || bp.Palette.LightMode
	for k, v := range bp.Palette.ExtendedColors {
		state.ExtendedColors[k] = v
	}
	state.SetPalette(palette)
	return writer.ApplyTheme(state, theme.DefaultApplySettings())
}

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
	wallpaperArg, args := parseFlag(args, "--wallpaper")
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: Base16 source (URL or file path) is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --import-base16 <url|file.yaml> [--wallpaper <url|path>] [--light-mode]")
		return 1
	}

	source := args[0]
	var filePath string
	if isURL(source) {
		fmt.Printf("Downloading Base16 scheme from: %s\n", source)
		dl, err := wallpaper.DownloadToCache(source)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download base16: %v\n", err)
			return 1
		}
		filePath = dl
	} else {
		filePath = expandHome(source)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Error: File not found: %s\n", filePath)
			return 1
		}
		fmt.Printf("Importing Base16 scheme from: %s\n", filePath)
	}

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

	wallpaperPath, err := resolveWallpaperArg(wallpaperArg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	fmt.Println("Applying theme...")
	result, err := applyImportedTheme(templatesFS, bp, palette, wallpaperPath, lightMode)
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
	wallpaperArg, args := parseFlag(args, "--wallpaper")
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: colors.toml source (URL or file path) is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --import-colors-toml <url|file.toml> [--wallpaper <url|path>] [--light-mode]")
		return 1
	}

	source := args[0]
	var bp *blueprint.Blueprint
	var err error
	if isURL(source) {
		fmt.Printf("Downloading colors.toml from: %s\n", source)
		bp, err = blueprint.ImportColorsTomlFromURL(source)
	} else {
		filePath := expandHome(source)
		if _, statErr := os.Stat(filePath); os.IsNotExist(statErr) {
			fmt.Fprintf(os.Stderr, "Error: File not found: %s\n", filePath)
			return 1
		}
		fmt.Printf("Importing colors.toml from: %s\n", filePath)
		bp, err = blueprint.ImportColorsToml(filePath)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	fmt.Printf("Parsed %d colors\n", len(bp.Palette.Colors))

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}

	wallpaperPath, err := resolveWallpaperArg(wallpaperArg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	fmt.Println("Applying theme...")
	result, err := applyImportedTheme(templatesFS, bp, palette, wallpaperPath, lightMode)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	if result.Success {
		fmt.Println("Theme applied successfully")
	}
	return 0
}
