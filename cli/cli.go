package cli

import (
	"embed"
	"fmt"
	"os"
	"strings"
)

// Version is set at build time via ldflags.
var Version = "dev"

// Run dispatches CLI commands. Returns exit code.
func Run(args []string, templatesFS embed.FS) int {
	if len(args) == 0 {
		printUsage()
		return 1
	}

	cmd := args[0]
	switch cmd {
	case "--generate":
		return runGenerate(args[1:], templatesFS)
	case "--list-blueprints":
		return runListBlueprints()
	case "--apply-blueprint":
		return runApplyBlueprint(args[1:], templatesFS)
	case "--import-blueprint":
		return runImportBlueprint(args[1:], templatesFS)
	case "--import-base16":
		return runImportBase16(args[1:], templatesFS)
	case "--import-colors-toml":
		return runImportColorsToml(args[1:], templatesFS)
	case "--help", "-h":
		printUsage()
		return 0
	case "--version", "-v":
		fmt.Printf("aether %s\n", Version)
		return 0
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", cmd)
		printUsage()
		return 1
	}
}

func printUsage() {
	fmt.Println(`Aether - Desktop Theme Generator

Usage:
  aether                                    Launch GUI
  aether --generate <wallpaper> [options]   Extract colors and apply theme
  aether --list-blueprints                  List saved themes
  aether --apply-blueprint <name>           Apply a saved theme
  aether --help                             Show this help
  aether --version                          Show version

GUI options:
  aether --widget-blueprint                 Launch blueprint widget
  aether --widget-wallpaper-slider           Launch wallpaper slider widget
  aether --tab <name>                       Open GUI with a specific tab focused

Import commands:
  aether --import-blueprint <url|path>   Import blueprint from URL or file
  aether --import-base16 <file.yaml>     Import Base16 color scheme
  aether --import-colors-toml <file>     Import colors.toml color scheme

Generate options:
  --extract-mode <mode>    Extraction mode (default: normal)
                           Modes: normal, monochromatic, analogous, pastel,
                                  material, colorful, muted, bright
  --light-mode             Generate light mode theme
  --no-apply               Generate files only, don't apply theme
  --output <path>          Custom output directory


Import options:
  --auto-apply             Apply theme after import (--import-blueprint)
  --wallpaper <path>       Include wallpaper with import
  --light-mode             Import as light mode theme`)
}

func parseFlag(args []string, flag string) (string, []string) {
	for i, arg := range args {
		if arg == flag && i+1 < len(args) {
			remaining := make([]string, 0, len(args)-2)
			remaining = append(remaining, args[:i]...)
			remaining = append(remaining, args[i+2:]...)
			return args[i+1], remaining
		}
	}
	return "", args
}

func hasFlag(args []string, flag string) (bool, []string) {
	for i, arg := range args {
		if arg == flag {
			remaining := make([]string, 0, len(args)-1)
			remaining = append(remaining, args[:i]...)
			remaining = append(remaining, args[i+1:]...)
			return true, remaining
		}
	}
	return false, args
}

// validModes are the allowed extraction modes.
var validModes = map[string]bool{
	"normal": true, "monochromatic": true, "analogous": true,
	"pastel": true, "material": true, "colorful": true,
	"muted": true, "bright": true,
}

func expandHome(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			return home + path[1:]
		}
	}
	return path
}
