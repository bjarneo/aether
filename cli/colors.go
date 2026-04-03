package cli

import (
	"fmt"
	"os"
	"strconv"

	"aether/internal/color"
	"aether/internal/extraction"
)

func runColorConvert(args []string) int {
	jsonOut, args := stripJSON(args)
	target, args := parseFlag(args, "--to")
	if target == "" {
		target = "rgb"
	}
	if len(args) == 0 {
		msg := "Usage: aether --color-convert <hex> [--to rgb|hsl|oklab|oklch]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	rgb := color.HexToRGB(hex)

	result := map[string]interface{}{
		"input": hex,
	}

	switch target {
	case "rgb":
		result["r"] = rgb.R
		result["g"] = rgb.G
		result["b"] = rgb.B
		result["format"] = "rgb"
		result["string"] = color.HexToRGBString(hex)
		if jsonOut {
			return printJSON(result)
		}
		fmt.Printf("rgb(%s)\n", color.HexToRGBString(hex))

	case "hsl":
		hsl := color.RGBToHSL(rgb.R, rgb.G, rgb.B)
		result["h"] = hsl.H
		result["s"] = hsl.S
		result["l"] = hsl.L
		result["format"] = "hsl"
		if jsonOut {
			return printJSON(result)
		}
		fmt.Printf("hsl(%.1f, %.1f%%, %.1f%%)\n", hsl.H, hsl.S, hsl.L)

	case "oklab":
		lab := color.HexToOKLab(hex)
		result["l"] = lab.L
		result["a"] = lab.A
		result["b"] = lab.B
		result["format"] = "oklab"
		if jsonOut {
			return printJSON(result)
		}
		fmt.Printf("oklab(%.4f, %.4f, %.4f)\n", lab.L, lab.A, lab.B)

	case "oklch":
		lch := color.HexToOKLCH(hex)
		result["l"] = lch.L
		result["c"] = lch.C
		result["h"] = lch.H
		result["format"] = "oklch"
		if jsonOut {
			return printJSON(result)
		}
		fmt.Printf("oklch(%.4f, %.4f, %.1f)\n", lch.L, lch.C, lch.H)

	default:
		msg := fmt.Sprintf("Unknown format: %s (valid: rgb, hsl, oklab, oklch)", target)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}
	return 0
}

func runContrast(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) < 2 {
		msg := "Usage: aether --contrast <color1> <color2>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex1 := normalizeHex(args[0])
	hex2 := normalizeHex(args[1])
	ratio := color.ContrastRatio(hex1, hex2)

	// WCAG grading
	aaLarge := ratio >= 3.0
	aa := ratio >= 4.5
	aaaLarge := ratio >= 4.5
	aaa := ratio >= 7.0

	if jsonOut {
		return printJSON(map[string]interface{}{
			"color1": hex1,
			"color2": hex2,
			"ratio":  ratio,
			"wcag": map[string]bool{
				"aa_large":  aaLarge,
				"aa":        aa,
				"aaa_large": aaaLarge,
				"aaa":       aaa,
			},
		})
	}

	fmt.Printf("Contrast ratio: %.2f:1\n", ratio)
	fmt.Printf("  AA large text:  %s\n", passFail(aaLarge))
	fmt.Printf("  AA normal text: %s\n", passFail(aa))
	fmt.Printf("  AAA large text: %s\n", passFail(aaaLarge))
	fmt.Printf("  AAA normal text: %s\n", passFail(aaa))
	return 0
}

func passFail(ok bool) string {
	if ok {
		return "PASS"
	}
	return "FAIL"
}

func runAdjustColor(args []string) int {
	jsonOut, args := stripJSON(args)
	adj, args := parseAdjustmentFlags(args)
	if len(args) == 0 {
		msg := "Usage: aether --adjust-color <hex> [--vibrance X] [--saturation X] [--contrast X] ..."
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	result := color.AdjustColor(hex, adj)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"input":  hex,
			"output": result,
		})
	}
	fmt.Println(result)
	return 0
}

func runDarken(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) < 2 {
		msg := "Usage: aether --darken <hex> <percent>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	percent, err := strconv.ParseFloat(args[1], 64)
	if err != nil {
		msg := fmt.Sprintf("Invalid percent: %s", args[1])
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	result := color.DarkenRGB(hex, percent)
	if jsonOut {
		return printJSON(map[string]interface{}{
			"input":   hex,
			"percent": percent,
			"output":  result,
		})
	}
	fmt.Println(result)
	return 0
}

func runLighten(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) < 2 {
		msg := "Usage: aether --lighten <hex> <percent>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	percent, err := strconv.ParseFloat(args[1], 64)
	if err != nil {
		msg := fmt.Sprintf("Invalid percent: %s", args[1])
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	result := color.LightenRGB(hex, percent)
	if jsonOut {
		return printJSON(map[string]interface{}{
			"input":   hex,
			"percent": percent,
			"output":  result,
		})
	}
	fmt.Println(result)
	return 0
}

func runColorInfo(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --color-info <hex>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	hex := normalizeHex(args[0])
	rgb := color.HexToRGB(hex)
	hsl := color.RGBToHSL(rgb.R, rgb.G, rgb.B)
	lab := color.HexToOKLab(hex)
	lch := color.HexToOKLCH(hex)
	isDark := extraction.IsDarkColor(hex)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"hex": hex,
			"rgb": map[string]float64{
				"r": rgb.R, "g": rgb.G, "b": rgb.B,
			},
			"hsl": map[string]float64{
				"h": hsl.H, "s": hsl.S, "l": hsl.L,
			},
			"oklab": map[string]float64{
				"l": lab.L, "a": lab.A, "b": lab.B,
			},
			"oklch": map[string]float64{
				"l": lch.L, "c": lch.C, "h": lch.H,
			},
			"rgb_string":  color.HexToRGBString(hex),
			"rgba_string": color.HexToRGBA(hex, 1.0),
			"is_dark":     isDark,
			"luminance":   lab.L,
		})
	}

	fmt.Printf("Color: %s\n", hex)
	fmt.Printf("  RGB:   rgb(%s)\n", color.HexToRGBString(hex))
	fmt.Printf("  HSL:   hsl(%.1f, %.1f%%, %.1f%%)\n", hsl.H, hsl.S, hsl.L)
	fmt.Printf("  OKLab: oklab(%.4f, %.4f, %.4f)\n", lab.L, lab.A, lab.B)
	fmt.Printf("  OKLCH: oklch(%.4f, %.4f, %.1f)\n", lch.L, lch.C, lch.H)
	fmt.Printf("  Dark:  %v\n", isDark)
	fmt.Printf("  Perceptual lightness: %.4f\n", lab.L)
	return 0
}
