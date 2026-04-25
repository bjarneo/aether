package extraction

import (
	"math"

	"aether/internal/color"
)

// oklchRule shapes an OKLCH color into a mode-specific output.
// Implementations may use any combination of the input channels (typically the hue) and
// return a fresh OKLCH; transformChromaticPalette converts back to hex.
type oklchRule struct {
	light func(lch color.OKLCH) color.OKLCH
	dark  func(lch color.OKLCH) color.OKLCH
}

// applyOklchRule selects the rule for the requested mode.
func applyOklchRule(rule *oklchRule, lch color.OKLCH, lightMode bool) color.OKLCH {
	if lightMode {
		return rule.light(lch)
	}
	return rule.dark(lch)
}

func clampF(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}

// finalizePalette regenerates derived slots (8, 9-14, 15) against the already-set bg/fg/ANSI
// and enforces minimum contrast for ANSI colors against the background. Callers must set
// slots 0, 7, and 1-6 before invoking.
func finalizePalette(p *[16]string) {
	p[8] = generateCommentColor(p[0])

	for i := 1; i <= 6; i++ {
		p[i+8] = GenerateBrightVersion(p[i])
	}
	p[15] = GenerateBrightVersion(p[7])

	for i := 1; i <= 6; i++ {
		if color.ContrastRatio(p[0], p[i]) < MinContrastRatio {
			p[i] = boostContrastAgainstBg(p[i], p[0], MinContrastRatio)
			p[i+8] = GenerateBrightVersion(p[i])
		}
	}
}

// pullHueToward shifts a hue toward target by strength (0..1) along the shorter arc.
// strength=0 keeps the original; strength=1 returns the target.
func pullHueToward(hue, target, strength float64) float64 {
	diff := math.Mod(target-hue+540, 360) - 180
	return math.Mod(hue+diff*strength+360, 360)
}

// extractDominantHue picks the OKLCH hue of the image's most chromatic dominant color —
// the image's primary "color identity" used by schemes/moods to pivot palettes.
// For fully achromatic images (all colors at C=0) it returns 0 (red); callers that
// care about achromatic detection should run IsMonochromeImage first.
func extractDominantHue(dominantColors []string) float64 {
	var hue float64
	bestChroma := 0.0
	for _, c := range dominantColors {
		lch := color.HexToOKLCH(c)
		if lch.C > bestChroma {
			bestChroma = lch.C
			hue = lch.H
		}
	}
	return hue
}

// transformChromaticPalette extracts image-derived hues and rebuilds the palette in OKLCH.
// bgRule shapes slot 0, fgRule shapes slot 7, ansiRule shapes slots 1-6, then
// ansiLightnessOffsets nudges each slot's lightness so colors stay distinguishable
// above the perceptual JND threshold. finalizePalette derives slots 8/9-15 and enforces
// AA contrast against the transformed background.
func transformChromaticPalette(
	dominantColors []string,
	lightMode bool,
	bgRule, fgRule, ansiRule *oklchRule,
	ansiLightnessOffsets [6]float64,
) [16]string {
	base := extractChromaticHues(dominantColors, lightMode)

	var result [16]string

	bgLch := color.HexToOKLCH(base[0])
	fgLch := color.HexToOKLCH(base[7])
	result[0] = color.OKLCHToHex(applyOklchRule(bgRule, bgLch, lightMode))
	result[7] = color.OKLCHToHex(applyOklchRule(fgRule, fgLch, lightMode))

	for i := 0; i < 6; i++ {
		slot := i + 1
		lch := color.HexToOKLCH(base[slot])
		shaped := applyOklchRule(ansiRule, lch, lightMode)
		shaped.L = clampF(shaped.L+ansiLightnessOffsets[i], 0.05, 0.95)
		result[slot] = color.OKLCHToHex(shaped)
	}

	finalizePalette(&result)
	return result
}

// Lightness stagger spreads are well above the OKLCH JND (~0.015) so slots remain
// distinguishable when the mode flattens chroma.

func GeneratePastelPalette(dominantColors []string, lightMode bool) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.96, C: 0.012, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.20, C: 0.022, H: lch.H} },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.32, C: 0.05, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.85, C: 0.04, H: lch.H} },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.55, C: clampF(lch.C, 0.045, 0.07), H: lch.H}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.78, C: clampF(lch.C, 0.05, 0.075), H: lch.H}
		},
	}
	stagger := [6]float64{-0.04, +0.02, +0.05, -0.03, -0.01, +0.03}
	return transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, stagger)
}

func GenerateColorfulPalette(dominantColors []string, lightMode bool) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.97, C: 0.012, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.10, C: 0.022, H: lch.H} },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.18, C: 0.04, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.92, C: 0.03, H: lch.H} },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.50, C: clampF(math.Max(lch.C, 0.14), 0.14, 0.20), H: lch.H}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.65, C: clampF(math.Max(lch.C, 0.14), 0.14, 0.20), H: lch.H}
		},
	}
	stagger := [6]float64{-0.05, +0.02, +0.06, -0.03, -0.02, +0.04}
	return transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, stagger)
}

// GenerateMutedPalette: low-chroma, subdued. Widened lightness stagger because slots
// can't lean on chroma differences for distinguishability.
func GenerateMutedPalette(dominantColors []string, lightMode bool) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.94, C: 0.010, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.16, C: 0.018, H: lch.H} },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.28, C: 0.045, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.84, C: 0.035, H: lch.H} },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.48, C: clampF(lch.C*0.5, 0.035, 0.065), H: lch.H}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.62, C: clampF(lch.C*0.5, 0.035, 0.065), H: lch.H}
		},
	}
	stagger := [6]float64{-0.10, -0.04, +0.04, +0.10, -0.07, +0.07}
	return transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, stagger)
}

func GenerateBrightPalette(dominantColors []string, lightMode bool) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.98, C: 0.010, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.10, C: 0.020, H: lch.H} },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.15, C: 0.04, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.92, C: 0.025, H: lch.H} },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.42, C: clampF(math.Max(lch.C, 0.10), 0.10, 0.18), H: lch.H}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.78, C: clampF(math.Max(lch.C, 0.10), 0.10, 0.18), H: lch.H}
		},
	}
	stagger := [6]float64{-0.04, +0.01, +0.06, -0.03, -0.02, +0.03}
	return transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, stagger)
}

// GenerateMaterialPalette generates a Material Design-inspired palette.
// Intentionally uses HSL (not OKLCH like the other modes): Material specifies fixed
// neutral bg/fg colors and a HSL-defined accent saturation/lightness contract, so
// porting this to OKLCH would drift from the spec.
func GenerateMaterialPalette(dominantColors []string, lightMode bool) [16]string {
	var palette [16]string
	usedIndices := make(map[int]bool)

	if lightMode {
		palette[0] = "#fafafa"
		palette[7] = "#212121"
	} else {
		palette[0] = "#121212"
		palette[7] = "#ffffff"
	}

	for i := 0; i < len(OKLCHAnsiHues); i++ {
		matchIndex := FindBestColorMatch(OKLCHAnsiHues[i], dominantColors, usedIndices, lightMode)
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

// GenerateAnalogousPalette generates an analogous palette (±30° in OKLCH around the dominant hue).
// Lightness alternates between dim and bright slots with a perceptually meaningful spread,
// so the six ANSI colors stay distinguishable when hues are close.
func GenerateAnalogousPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	if lightMode {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.92, lightest.Lightness), C: 0.02, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.28, darkest.Lightness+0.05), C: 0.04, H: baseHue})
	} else {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.16, darkest.Lightness), C: 0.03, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.88, lightest.Lightness-0.05), C: 0.025, H: baseHue})
	}

	analogousOffsets := [6]float64{-30, -18, -6, 6, 18, 30}
	chromaLevels := [6]float64{0.10, 0.13, 0.09, 0.14, 0.10, 0.12}
	lightnessStagger := [6]float64{-0.06, +0.04, -0.04, +0.06, -0.05, +0.05}
	lightnessBase := 0.62
	if lightMode {
		lightnessBase = 0.50
	}

	for i := 0; i < 6; i++ {
		hue := math.Mod(baseHue+analogousOffsets[i]+360, 360)
		lightness := clampF(lightnessBase+lightnessStagger[i], 0.30, 0.85)
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: lightness, C: chromaLevels[i], H: hue})
	}

	palette[8] = generateCommentColor(palette[0])

	for i := 0; i < 6; i++ {
		hue := math.Mod(baseHue+analogousOffsets[i]+360, 360)
		brightL := clampF(lightnessBase+lightnessStagger[i]+0.10, 0.30, 0.92)
		if lightMode {
			brightL = clampF(lightnessBase+lightnessStagger[i]-0.10, 0.20, 0.70)
		}
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: brightL, C: chromaLevels[i] + 0.02, H: hue})
	}

	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.10, C: 0.04, H: baseHue})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.97, C: 0.015, H: baseHue})
	}

	return palette
}
