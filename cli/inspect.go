package cli

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"aether/internal/extraction"
	"aether/internal/omarchy"
	"aether/internal/platform"
	"aether/internal/template"
	"aether/internal/theme"
)

// resolvePalette tries source as inline palette JSON first, then as a wallpaper
// file path (with ~ expansion). Returns the populated palette or an error
// describing what went wrong — caller decides how to surface it.
func resolvePalette(source string, lightMode bool) ([16]string, error) {
	var palette [16]string
	colors, parseErr := parsePaletteArg(source)
	if parseErr == nil && len(colors) >= 16 {
		for i := 0; i < 16; i++ {
			palette[i] = colors[i]
		}
		return palette, nil
	}
	path := expandHome(source)
	if _, statErr := os.Stat(path); statErr != nil {
		return palette, fmt.Errorf("source not found: %s", source)
	}
	extracted, err := extraction.ExtractColors(path, lightMode, "normal")
	if err != nil {
		return palette, fmt.Errorf("failed to extract colors: %w", err)
	}
	return extracted, nil
}

func runListApps(args []string, templatesFS embed.FS) int {
	jsonOut, _ := stripJSON(args)

	names, err := template.ListTemplates(templatesFS, "templates")
	if err != nil {
		msg := fmt.Sprintf("Failed to list templates: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	apps := make([]string, 0, len(names))
	seen := make(map[string]bool)
	for _, name := range names {
		if name == "copy.json" {
			continue
		}
		app := theme.GetAppNameFromFileName(name)
		if !seen[app] {
			seen[app] = true
			apps = append(apps, app)
		}
	}
	sort.Strings(apps)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"apps":  apps,
			"count": len(apps),
		})
	}

	fmt.Printf("Supported applications (%d):\n", len(apps))
	for _, app := range apps {
		fmt.Printf("  %s\n", app)
	}
	return 0
}

func runListModes(args []string) int {
	jsonOut, _ := stripJSON(args)

	type modeInfo struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	modes := []modeInfo{
		{"normal", "Auto-detect: monochrome or chromatic based on image analysis"},
		{"monochromatic", "Single-hue palette with varying lightness"},
		{"analogous", "Colors within ±30° hue range in OKLCH space"},
		{"pastel", "Soft, low-chroma, high-lightness palette in OKLCH"},
		{"material", "Material Design-inspired palette with balanced saturation"},
		{"colorful", "High-chroma, vibrant palette in OKLCH"},
		{"muted", "Low-chroma, subdued palette with widened lightness stagger"},
		{"bright", "High-lightness palette with healthy chroma"},
		{"complementary", "Base hue and 180° opposite alternating across slots"},
		{"triadic", "Three hues at 120° spacing"},
		{"split-complementary", "Base hue plus 150°/210° (softer than complementary)"},
		{"tetradic", "Four hues at 90° spacing (rectangle on the wheel)"},
		{"fire", "Bonfire mood: deep dark bg, warm-shifted ANSI hues"},
		{"ocean", "Ocean mood: blue-black bg, cool-shifted ANSI hues"},
		{"forest", "Forest mood: green-black bg, sage-shifted ANSI hues"},
		{"earthtone", "Earth mood: warm dark brown bg, very low chroma ANSI"},
		{"neon", "Cyberpunk mood: very dark bg, max chroma narrow lightness band"},
		{"sunset", "Sunset mood: warm dark with magenta cast, peach fg"},
		{"vaporwave", "Vaporwave mood: pinks/purples/cyans on a soft dark"},
		{"midnight", "Midnight mood: deep indigo, subdued, peaceful"},
		{"aurora", "Aurora mood: shimmery green-cyan glow on deep blue-night"},
		{"high-contrast", "WCAG AAA (7:1) contrast against a hard-extreme background"},
		{"duotone", "Two hues only (base + complement) at varying lightness"},
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"modes": modes,
			"count": len(modes),
		})
	}

	fmt.Println("Extraction modes:")
	for _, m := range modes {
		fmt.Printf("  %-15s %s\n", m.Name, m.Description)
	}
	return 0
}

func runShowVariables(args []string, templatesFS embed.FS) int {
	jsonOut, args := stripJSON(args)
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		msg := "Usage: aether --show-variables <wallpaper|blueprint-name> [--light-mode]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	source := args[0]
	palette, err := resolvePalette(source, lightMode)
	if err != nil {
		if jsonOut {
			return printErrorJSON(err.Error())
		}
		fmt.Fprintln(os.Stderr, "Error:", err)
		return 1
	}

	roles := MapColorsToRoles(palette)
	vars := template.BuildVariables(roles, lightMode)

	if jsonOut {
		return printJSON(vars)
	}

	// Sort keys for readable output
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		fmt.Printf("  %-25s %s\n", k, vars[k])
	}
	return 0
}

func runCurrentTheme(args []string) int {
	jsonOut, _ := stripJSON(args)

	colorsPath := filepath.Join(platform.ThemeDir(), "colors.toml")
	data, err := os.ReadFile(colorsPath)
	if err != nil {
		msg := "No theme currently applied (colors.toml not found)"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	colors, bg, fg := omarchy.ParseColorsToml(string(data))

	if jsonOut {
		colorSlice := colors[:]
		return printJSON(map[string]interface{}{
			"colors":     colorSlice,
			"background": bg,
			"foreground": fg,
			"path":       colorsPath,
		})
	}

	fmt.Printf("Current theme (from %s):\n", colorsPath)
	if bg != "" {
		fmt.Printf("  background: %s\n", bg)
	}
	if fg != "" {
		fmt.Printf("  foreground: %s\n", fg)
	}
	for i, c := range colors {
		if c != "" {
			fmt.Printf("  %2d %-16s %s\n", i, paletteNames[i], c)
		}
	}
	return 0
}

func runPreviewTemplate(args []string, templatesFS embed.FS) int {
	jsonOut, args := stripJSON(args)
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) < 2 {
		msg := "Usage: aether --preview-template <app> <wallpaper|blueprint-name> [--light-mode]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	appName := args[0]
	source := args[1]

	// Find the template file for this app
	templateFile := ""
	names, err := template.ListTemplates(templatesFS, "templates")
	if err != nil {
		msg := fmt.Sprintf("Failed to list templates: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}
	for _, name := range names {
		if theme.GetAppNameFromFileName(name) == appName {
			templateFile = name
			break
		}
	}
	if templateFile == "" {
		msg := fmt.Sprintf("No template found for app: %s", appName)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	palette, palErr := resolvePalette(source, lightMode)
	if palErr != nil {
		if jsonOut {
			return printErrorJSON(palErr.Error())
		}
		fmt.Fprintln(os.Stderr, "Error:", palErr)
		return 1
	}

	roles := MapColorsToRoles(palette)
	vars := template.BuildVariables(roles, lightMode)

	// Read and process template
	content, err := template.ReadTemplate(templatesFS, "templates", templateFile)
	if err != nil {
		msg := fmt.Sprintf("Failed to read template: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	processed := template.ProcessTemplate(content, vars)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"app":      appName,
			"template": templateFile,
			"content":  processed,
		})
	}

	fmt.Print(processed)
	return 0
}
