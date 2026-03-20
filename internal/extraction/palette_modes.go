package extraction

import (
	"math"

	"aether/internal/color"
)

// paletteRule defines how to transform a color in light and dark modes.
type paletteRule struct {
	light func(hsl color.HSL) string
	dark  func(hsl color.HSL) string
}

// transformChromaticPalette generates a chromatic palette then transforms each color
// using the provided index-specific rules.
func transformChromaticPalette(dominantColors []string, lightMode bool, rules map[int]*paletteRule, defaultRule *paletteRule) [16]string {
	base := GenerateChromaticPalette(dominantColors, lightMode)

	var result [16]string
	for i := 0; i < 16; i++ {
		hsl := color.HexToHSL(base[i])
		rule := rules[i]
		if rule == nil {
			rule = defaultRule
		}
		if lightMode {
			result[i] = rule.light(hsl)
		} else {
			result[i] = rule.dark(hsl)
		}
	}

	return result
}

// GeneratePastelPalette generates a pastel color palette (low saturation, high lightness).
func GeneratePastelPalette(dominantColors []string, lightMode bool) [16]string {
	return transformChromaticPalette(dominantColors, lightMode, map[int]*paletteRule{
		0: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 95) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 20) },
		},
		7: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 25, 35) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 20, 75) },
		},
		15: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 25, 35) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 20, 75) },
		},
		8: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 65) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 12, 45) },
		},
	}, &paletteRule{
		light: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H, math.Min(35, hsl.S), 50)
		},
		dark: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H, math.Min(35, hsl.S), 70)
		},
	})
}

// GenerateColorfulPalette generates a highly saturated, vibrant colorful palette.
func GenerateColorfulPalette(dominantColors []string, lightMode bool) [16]string {
	return transformChromaticPalette(dominantColors, lightMode, map[int]*paletteRule{
		0: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 98) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 12, 8) },
		},
		7: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 10) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 95) },
		},
		15: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 10) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 95) },
		},
		8: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 20, 50) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 55) },
		},
	}, &paletteRule{
		light: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(75, math.Min(95, hsl.S+30)),
				math.Max(35, math.Min(55, hsl.L)),
			)
		},
		dark: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(75, math.Min(95, hsl.S+30)),
				math.Max(55, math.Min(70, hsl.L)),
			)
		},
	})
}

// GenerateMutedPalette generates a desaturated, muted palette with subdued colors.
func GenerateMutedPalette(dominantColors []string, lightMode bool) [16]string {
	return transformChromaticPalette(dominantColors, lightMode, map[int]*paletteRule{
		0: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 5, 95) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 15) },
		},
		7: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 20) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 85) },
		},
		15: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 20) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 85) },
		},
		8: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 60) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 6, 50) },
		},
	}, &paletteRule{
		light: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(15, math.Min(35, hsl.S*0.5)),
				math.Max(40, math.Min(60, hsl.L)),
			)
		},
		dark: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(15, math.Min(35, hsl.S*0.5)),
				math.Max(50, math.Min(65, hsl.L)),
			)
		},
	})
}

// GenerateBrightPalette generates a high-lightness bright palette with punchy colors.
func GenerateBrightPalette(dominantColors []string, lightMode bool) [16]string {
	return transformChromaticPalette(dominantColors, lightMode, map[int]*paletteRule{
		0: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 6, 98) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 10, 6) },
		},
		7: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 12, 15) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 98) },
		},
		15: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 12, 15) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 8, 98) },
		},
		8: {
			light: func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 15, 55) },
			dark:  func(hsl color.HSL) string { return color.HSLToHex(hsl.H, 12, 65) },
		},
	}, &paletteRule{
		light: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(45, math.Min(70, hsl.S)),
				math.Max(45, math.Min(65, hsl.L+10)),
			)
		},
		dark: func(hsl color.HSL) string {
			return color.HSLToHex(hsl.H,
				math.Max(45, math.Min(70, hsl.S)),
				math.Max(65, math.Min(80, hsl.L+15)),
			)
		},
	})
}

// GenerateMaterialPalette generates a Material Design-inspired palette.
func GenerateMaterialPalette(dominantColors []string, lightMode bool) [16]string {
	var palette [16]string
	usedIndices := make(map[int]bool)

	// Material backgrounds
	if lightMode {
		palette[0] = "#fafafa"
		palette[7] = "#212121"
	} else {
		palette[0] = "#121212"
		palette[7] = "#ffffff"
	}

	// Find best ANSI color matches from actual image colors
	for i := 0; i < len(ANSIHueArray); i++ {
		matchIndex := FindBestColorMatch(ANSIHueArray[i], dominantColors, usedIndices)
		matchedColor := dominantColors[matchIndex]
		hsl := color.HexToHSL(matchedColor)

		refinedSaturation := math.Max(hsl.S, 35)
		var refinedLightness float64
		if lightMode {
			refinedLightness = math.Max(35, math.Min(60, hsl.L))
		} else {
			refinedLightness = math.Max(45, math.Min(70, hsl.L))
		}

		palette[i+1] = color.HSLToHex(hsl.H, refinedSaturation, refinedLightness)
		usedIndices[matchIndex] = true
	}

	if lightMode {
		palette[8] = "#757575"
	} else {
		palette[8] = "#9e9e9e"
	}

	for i := 1; i <= 6; i++ {
		hsl := color.HexToHSL(palette[i])
		brightSaturation := math.Min(100, hsl.S+8)
		var brightLightness float64
		if lightMode {
			brightLightness = math.Max(30, hsl.L-8)
		} else {
			brightLightness = math.Min(75, hsl.L+8)
		}
		palette[i+8] = color.HSLToHex(hsl.H, brightSaturation, brightLightness)
	}

	if lightMode {
		palette[15] = "#000000"
	} else {
		palette[15] = "#ffffff"
	}

	return palette
}

// GenerateAnalogousPalette generates an analogous color palette (adjacent hues on the color wheel).
func GenerateAnalogousPalette(dominantColors []string, lightMode bool) [16]string {
	// Find most saturated chromatic color as base
	type chromaticEntry struct {
		c          string
		hsl        color.HSL
		saturation float64
	}

	var chromaticColors []chromaticEntry
	for _, c := range dominantColors {
		hsl := color.HexToHSL(c)
		if hsl.S > MonochromeSaturationThreshold {
			chromaticColors = append(chromaticColors, chromaticEntry{c: c, hsl: hsl, saturation: hsl.S})
		}
	}

	// Sort by saturation descending
	for i := 0; i < len(chromaticColors); i++ {
		for j := i + 1; j < len(chromaticColors); j++ {
			if chromaticColors[j].saturation > chromaticColors[i].saturation {
				chromaticColors[i], chromaticColors[j] = chromaticColors[j], chromaticColors[i]
			}
		}
	}

	var baseHue float64
	if len(chromaticColors) > 0 {
		baseHue = chromaticColors[0].hsl.H
	} else {
		hsl := color.HexToHSL(dominantColors[0])
		baseHue = hsl.H
	}

	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	if lightMode {
		palette[0] = color.HSLToHex(baseHue, 12, math.Max(90, lightest.Lightness))
		palette[7] = color.HSLToHex(baseHue, 30, math.Min(25, darkest.Lightness+10))
	} else {
		palette[0] = color.HSLToHex(baseHue, 18, math.Min(12, darkest.Lightness))
		palette[7] = color.HSLToHex(baseHue, 15, math.Max(85, lightest.Lightness-10))
	}

	analogousOffsets := [6]float64{-30, -20, -10, 10, 20, 30}
	saturationLevels := [6]float64{45, 50, 48, 52, 47, 50}
	lightnessBase := 58.0
	if lightMode {
		lightnessBase = 45.0
	}

	for i := 0; i < 6; i++ {
		hue := math.Mod(baseHue+analogousOffsets[i]+360, 360)
		lightness := lightnessBase - 3
		if i%2 != 0 {
			lightness = lightnessBase + 3
		}
		palette[i+1] = color.HSLToHex(hue, saturationLevels[i], lightness)
	}

	if lightMode {
		palette[8] = color.HSLToHex(baseHue, 20, 55)
	} else {
		palette[8] = color.HSLToHex(baseHue, 15, 45)
	}

	for i := 0; i < 6; i++ {
		hue := math.Mod(baseHue+analogousOffsets[i]+360, 360)
		lightness := 68.0
		if lightMode {
			lightness = 38.0
		}
		palette[i+9] = color.HSLToHex(hue, saturationLevels[i]+8, lightness)
	}

	if lightMode {
		palette[15] = color.HSLToHex(baseHue, 20, 20)
	} else {
		palette[15] = color.HSLToHex(baseHue, 10, 95)
	}

	return palette
}
