package cli

import (
	"fmt"
	"math"
	"os"
	"strconv"

	"aether/internal/color"
	"aether/internal/extraction"
)

func runExtractPalette(args []string) int {
	jsonOut, args := stripJSON(args)
	mode, args := parseFlag(args, "--extract-mode")
	if mode == "" {
		mode = "normal"
	}
	lightMode, args := hasFlag(args, "--light-mode")

	if len(args) == 0 {
		msg := "Usage: aether --extract-palette <wallpaper> [--extract-mode <mode>] [--light-mode]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	if !validModes[mode] {
		msg := fmt.Sprintf("Invalid extraction mode: %s", mode)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	wallpaperPath := expandHome(args[0])
	if _, err := os.Stat(wallpaperPath); os.IsNotExist(err) {
		msg := fmt.Sprintf("File not found: %s", wallpaperPath)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	palette, err := extraction.ExtractColors(wallpaperPath, lightMode, mode)
	if err != nil {
		msg := fmt.Sprintf("Failed to extract colors: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	colors := palette[:]
	if jsonOut {
		return printJSON(map[string]interface{}{
			"colors":    colors,
			"mode":      mode,
			"lightMode": lightMode,
			"wallpaper": wallpaperPath,
		})
	}

	for i, c := range colors {
		fmt.Printf("  %2d: %s\n", i, c)
	}
	return 0
}

func runPaletteFromColor(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --palette-from-color <hex>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	palette := color.GeneratePaletteFromColor(hex)
	colors := palette[:]

	if jsonOut {
		return printJSON(map[string]interface{}{
			"base":   hex,
			"colors": colors,
		})
	}

	fmt.Printf("Palette from %s:\n", hex)
	for i, c := range colors {
		fmt.Printf("  %2d: %s\n", i, c)
	}
	return 0
}

func runGradient(args []string) int {
	jsonOut, args := stripJSON(args)
	stepsStr, args := parseFlag(args, "--steps")
	steps := 16
	if stepsStr != "" {
		if v, err := strconv.Atoi(stepsStr); err == nil && v >= 2 {
			steps = v
		}
	}

	if len(args) < 2 {
		msg := "Usage: aether --gradient <start-color> <end-color> [--steps N]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	start := normalizeHex(args[0])
	end := normalizeHex(args[1])

	var colors []string
	if steps == 16 {
		palette := color.GenerateGradient(start, end)
		colors = palette[:]
	} else {
		// Custom step count: inline linear interpolation
		sRGB := color.HexToRGB(start)
		eRGB := color.HexToRGB(end)
		colors = make([]string, steps)
		for i := 0; i < steps; i++ {
			t := float64(i) / float64(steps-1)
			r := math.Round(sRGB.R + (eRGB.R-sRGB.R)*t)
			g := math.Round(sRGB.G + (eRGB.G-sRGB.G)*t)
			b := math.Round(sRGB.B + (eRGB.B-sRGB.B)*t)
			colors[i] = color.RGBToHex(r, g, b)
		}
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"start":  start,
			"end":    end,
			"steps":  steps,
			"colors": colors,
		})
	}

	for i, c := range colors {
		fmt.Printf("  %2d: %s\n", i, c)
	}
	return 0
}

func runAdjustPalette(args []string) int {
	jsonOut, args := stripJSON(args)
	adj, args := parseAdjustmentFlags(args)

	if len(args) == 0 {
		msg := "Usage: aether --adjust-palette <json-array|blueprint-name> [--vibrance X] ..."
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	colors, err := parsePaletteArg(args[0])
	if err != nil {
		msg := err.Error()
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	result := make([]string, len(colors))
	for i, hex := range colors {
		if hex != "" {
			result[i] = color.AdjustColor(hex, adj)
		}
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"input":  colors,
			"output": result,
		})
	}

	for i, c := range result {
		fmt.Printf("  %2d: %s\n", i, c)
	}
	return 0
}

func runPaletteInfo(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --palette-info <json-array|blueprint-name>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	colors, err := parsePaletteArg(args[0])
	if err != nil {
		msg := err.Error()
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	// Analyze the palette
	isDark := len(colors) > 0 && extraction.IsDarkColor(colors[0])
	isMonochrome := extraction.IsMonochromeImage(colors)

	// Background/foreground contrast
	bgFgContrast := 0.0
	if len(colors) >= 8 {
		bgFgContrast = color.ContrastRatio(colors[0], colors[7])
	}

	// Per-color info
	type colorDetail struct {
		Index     int     `json:"index"`
		Hex       string  `json:"hex"`
		IsDark    bool    `json:"is_dark"`
		Lightness float64 `json:"lightness"`
	}

	details := make([]colorDetail, len(colors))
	for i, c := range colors {
		lab := color.HexToOKLab(c)
		details[i] = colorDetail{
			Index:     i,
			Hex:       c,
			IsDark:    extraction.IsDarkColor(c),
			Lightness: lab.L,
		}
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"count":              len(colors),
			"dark_theme":         isDark,
			"monochrome":         isMonochrome,
			"bg_fg_contrast":     bgFgContrast,
			"bg_fg_contrast_aaa": bgFgContrast >= 7.0,
			"colors":             details,
		})
	}

	themeType := "dark"
	if !isDark {
		themeType = "light"
	}
	fmt.Printf("Palette: %d colors, %s theme\n", len(colors), themeType)
	if isMonochrome {
		fmt.Println("  Style: monochrome")
	}
	if len(colors) >= 8 {
		fmt.Printf("  BG/FG contrast: %.2f:1 (%s)\n", bgFgContrast, passFail(bgFgContrast >= 7.0))
	}
	fmt.Println("  Colors:")
	for _, d := range details {
		fmt.Printf("    %2d: %s  L=%.3f\n", d.Index, d.Hex, d.Lightness)
	}
	return 0
}
