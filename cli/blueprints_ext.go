package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"aether/internal/blueprint"
)

func runShowBlueprint(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --show-blueprint <name>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	name := args[0]
	svc := blueprint.NewService()
	bp, err := svc.FindByName(name)
	if err != nil {
		msg := fmt.Sprintf("Error: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}
	if bp == nil {
		msg := fmt.Sprintf("Blueprint %q not found", name)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	if jsonOut {
		return printJSON(bp)
	}

	fmt.Printf("Blueprint: %s\n", bp.Name)
	fmt.Printf("  Timestamp: %d\n", bp.Timestamp)
	fmt.Printf("  Light mode: %v\n", bp.Palette.LightMode)
	if bp.Palette.Wallpaper != "" {
		fmt.Printf("  Wallpaper: %s\n", bp.Palette.Wallpaper)
	}
	if bp.Palette.WallpaperURL != "" {
		fmt.Printf("  Wallpaper URL: %s\n", bp.Palette.WallpaperURL)
	}
	fmt.Println("  Colors:")
	names := [16]string{
		"black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
		"bright_black", "bright_red", "bright_green", "bright_yellow",
		"bright_blue", "bright_magenta", "bright_cyan", "bright_white",
	}
	for i, c := range bp.Palette.Colors {
		if i < 16 {
			fmt.Printf("    %2d %-16s %s\n", i, names[i], c)
		}
	}
	if len(bp.AppOverrides) > 0 {
		fmt.Printf("  App overrides: %d app(s)\n", len(bp.AppOverrides))
		for app := range bp.AppOverrides {
			fmt.Printf("    - %s\n", app)
		}
	}
	return 0
}

func runDeleteBlueprint(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --delete-blueprint <name>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	name := args[0]
	svc := blueprint.NewService()

	// Verify it exists first
	bp, err := svc.FindByName(name)
	if err != nil {
		msg := fmt.Sprintf("Error: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}
	if bp == nil {
		msg := fmt.Sprintf("Blueprint %q not found", name)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	if err := svc.Delete(bp.Name); err != nil {
		msg := fmt.Sprintf("Failed to delete: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"deleted": bp.Name,
			"ok":      true,
		})
	}
	fmt.Printf("Deleted blueprint: %s\n", bp.Name)
	return 0
}

func runExportBlueprint(args []string) int {
	jsonOut, args := stripJSON(args)
	outputPath, args := parseFlag(args, "--output")

	if len(args) == 0 {
		msg := "Usage: aether --export-blueprint <name> [--output <path>]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	name := args[0]
	svc := blueprint.NewService()
	bp, err := svc.FindByName(name)
	if err != nil {
		msg := fmt.Sprintf("Error: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}
	if bp == nil {
		msg := fmt.Sprintf("Blueprint %q not found", name)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	data, err := json.MarshalIndent(bp, "", "  ")
	if err != nil {
		msg := fmt.Sprintf("Failed to marshal: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if outputPath == "" {
		// Default: blueprint name as filename in current directory
		outputPath = filepath.Clean(bp.Name + ".json")
	} else {
		outputPath = expandHome(outputPath)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		msg := fmt.Sprintf("Failed to write: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"exported": bp.Name,
			"path":     outputPath,
			"ok":       true,
		})
	}
	fmt.Printf("Exported blueprint %q to %s\n", bp.Name, outputPath)
	return 0
}
