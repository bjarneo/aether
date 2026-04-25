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
	// --- Existing commands ---
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

	// --- Color utilities ---
	case "--color-convert":
		return runColorConvert(args[1:])
	case "--contrast":
		return runContrast(args[1:])
	case "--adjust-color":
		return runAdjustColor(args[1:])
	case "--darken":
		return runDarken(args[1:])
	case "--lighten":
		return runLighten(args[1:])
	case "--color-info":
		return runColorInfo(args[1:])

	// --- Palette operations ---
	case "--extract-palette":
		return runExtractPalette(args[1:])
	case "--palette-from-color":
		return runPaletteFromColor(args[1:])
	case "--gradient":
		return runGradient(args[1:])
	case "--adjust-palette":
		return runAdjustPalette(args[1:])
	case "--palette-info":
		return runPaletteInfo(args[1:])

	// --- Blueprint extensions ---
	case "--show-blueprint":
		return runShowBlueprint(args[1:])
	case "--delete-blueprint":
		return runDeleteBlueprint(args[1:])
	case "--export-blueprint":
		return runExportBlueprint(args[1:])

	// --- Inspection ---
	case "--list-apps":
		return runListApps(args[1:], templatesFS)
	case "--list-modes":
		return runListModes(args[1:])
	case "--show-variables":
		return runShowVariables(args[1:], templatesFS)
	case "--current-theme":
		return runCurrentTheme(args[1:])
	case "--preview-template":
		return runPreviewTemplate(args[1:], templatesFS)

	// --- Wallpapers ---
	case "--search-wallhaven":
		return runSearchWallhaven(args[1:])
	case "--list-wallpapers":
		return runListWallpapers(args[1:])
	case "--random-wallpaper":
		return runRandomWallpaper(args[1:])

	// --- Favorites ---
	case "--list-favorites":
		return runListFavorites(args[1:])
	case "--toggle-favorite":
		return runToggleFavorite(args[1:])
	case "--is-favorite":
		return runIsFavorite(args[1:])

	// --- Meta ---
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
  aether --help                             Show this help
  aether --version                          Show version

Theme generation:
  aether --generate <wallpaper> [options]   Extract colors and apply theme
  aether --extract-palette <wallpaper>      Extract palette (read-only, no apply)

Blueprint management:
  aether --list-blueprints                  List saved themes
  aether --show-blueprint <name>            Show blueprint details
  aether --apply-blueprint <name>           Apply a saved theme
  aether --delete-blueprint <name>          Delete a blueprint
  aether --export-blueprint <name>          Export blueprint to JSON file

Import commands:
  aether --import-blueprint <url|path>      Import blueprint from URL or file
  aether --import-base16 <file.yaml>        Import Base16 color scheme
  aether --import-colors-toml <file>        Import colors.toml color scheme

Color utilities:
  aether --color-info <hex>                 Show all color representations
  aether --color-convert <hex> [--to fmt]   Convert color (rgb|hsl|oklab|oklch)
  aether --contrast <color1> <color2>       WCAG contrast ratio + grading
  aether --adjust-color <hex> [adjustments] Apply adjustment pipeline
  aether --darken <hex> <percent>           Darken a color
  aether --lighten <hex> <percent>          Lighten a color

Palette operations:
  aether --palette-from-color <hex>         Generate 16-color palette from one color
  aether --gradient <start> <end>           Generate color gradient
  aether --adjust-palette <colors> [adj]    Adjust entire palette
  aether --palette-info <colors|blueprint>  Analyze palette

Inspection:
  aether --list-apps                        List supported applications
  aether --list-modes                       List extraction modes
  aether --show-variables <source>          Show template variables
  aether --current-theme                    Show currently applied theme
  aether --preview-template <app> <source>  Preview rendered template

Wallpapers:
  aether --search-wallhaven <query>         Search wallhaven.cc
  aether --list-wallpapers                  List local wallpapers
  aether --random-wallpaper                 Pick random local wallpaper

Favorites:
  aether --list-favorites                   List all favorites
  aether --toggle-favorite <path>           Add/remove favorite
  aether --is-favorite <path>               Check if favorited

Remote control (requires running Aether GUI):
  aether status                             Show editor state
  aether extract <wallpaper>                Load wallpaper into editor
  aether set-color <index> <hex>            Change palette color
  aether adjust [--vibrance X] ...          Adjust palette sliders
  aether set-mode <mode>                    Change extraction mode
  aether apply                              Apply current theme
  aether toggle-light-mode                  Toggle light/dark mode
  aether load-blueprint <name>              Load blueprint into editor
  aether apply-blueprint <name>             Apply blueprint directly
  aether set-wallpaper <path>               Set wallpaper path

GUI options:
  aether --widget-blueprint                 Launch blueprint widget
  aether --widget-wallpaper-slider          Launch wallpaper slider widget
  aether --widget-themes-slider             Launch themes slider widget
  aether --tab <name>                       Open GUI with specific tab

Global options:
  --json                                    Machine-readable JSON output
  --light-mode                              Use light mode
  --extract-mode <mode>                     Extraction mode (see --list-modes)`)
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
	"complementary": true, "triadic": true,
	"split-complementary": true, "tetradic": true,
	"fire": true, "ocean": true, "forest": true,
	"earthtone": true, "neon": true, "sunset": true, "vaporwave": true,
	"midnight": true, "aurora": true,
	"high-contrast": true, "duotone": true,
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
