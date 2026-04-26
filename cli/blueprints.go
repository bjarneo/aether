package cli

import (
	"embed"
	"fmt"
	"os"
	"sort"

	"aether/internal/blueprint"
	"aether/internal/platform"
	"aether/internal/theme"
	"aether/internal/wallhaven"
)

func runListBlueprints() int {
	svc := blueprint.NewService()
	blueprints, err := svc.LoadAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing blueprints: %v\n", err)
		return 1
	}

	// Sort by timestamp (newest first)
	sort.Slice(blueprints, func(i, j int) bool {
		return blueprints[i].Timestamp > blueprints[j].Timestamp
	})

	if len(blueprints) == 0 {
		fmt.Println("No blueprints found.")
		return 0
	}

	for _, bp := range blueprints {
		fmt.Println(bp.Name)
	}
	return 0
}

func runApplyBlueprint(args []string, templatesFS embed.FS) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Error: Blueprint name is required")
		fmt.Fprintln(os.Stderr, "Usage: aether --apply-blueprint <name>")
		return 1
	}

	name := args[0]
	svc := blueprint.NewService()

	bp, err := svc.FindByName(name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	if bp == nil {
		fmt.Fprintf(os.Stderr, "Error: Blueprint %q not found\n", name)
		fmt.Fprintln(os.Stderr, "\nAvailable blueprints:")
		blueprints, _ := svc.LoadAll()
		if len(blueprints) == 0 {
			fmt.Fprintln(os.Stderr, "  (none)")
		} else {
			for _, b := range blueprints {
				fmt.Fprintf(os.Stderr, "  - %s\n", b.Name)
			}
		}
		return 1
	}

	if !svc.Validate(bp) {
		fmt.Fprintln(os.Stderr, "Error: Blueprint has invalid structure")
		return 1
	}

	// Build palette array
	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}

	colorRoles := MapColorsToRoles(palette)
	lightMode := bp.Palette.LightMode
	wallpaperPath := resolveWallpaperCLI(bp.Palette)

	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:       palette,
		WallpaperPath: wallpaperPath,
		LightMode:     lightMode,
		ColorRoles:    colorRoles,
		AppOverrides:  bp.AppOverrides,
	}

	settings := theme.Settings{}
	fmt.Printf("Applying blueprint: %s\n", bp.Name)
	result, err := writer.ApplyTheme(state, settings)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to apply blueprint: %v\n", err)
		return 1
	}

	if result.Success {
		fmt.Printf("Applied blueprint: %s\n", bp.Name)
	}
	return 0
}

// resolveWallpaperCLI returns a local wallpaper path from palette data. If the
// local path exists it is returned directly. Otherwise, if a URL is available,
// the wallpaper is downloaded.
func resolveWallpaperCLI(palette blueprint.PaletteData) string {
	if palette.Wallpaper != "" && platform.FileExists(palette.Wallpaper) {
		return palette.Wallpaper
	}
	if palette.WallpaperURL != "" {
		client := wallhaven.NewClient()
		localPath, err := client.DownloadFromURL(palette.WallpaperURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not download wallpaper from %s: %v\n", palette.WallpaperURL, err)
			return ""
		}
		fmt.Printf("Downloaded wallpaper: %s\n", localPath)
		return localPath
	}
	return ""
}
