package extraction

import (
	"math"

	"aether/internal/color"
)

// GenerateHighContrastPalette: image-aware hue assignment with WCAG AAA contrast against
// a hard-extreme background. For low-vision users or glare-prone displays.
func GenerateHighContrastPalette(dominantColors []string, lightMode bool) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.99, C: 0.005, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.05, C: 0.010, H: lch.H} },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.10, C: 0.020, H: lch.H} },
		dark:  func(lch color.OKLCH) color.OKLCH { return color.OKLCH{L: 0.95, C: 0.015, H: lch.H} },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.32, C: clampF(lch.C, 0.10, 0.18), H: lch.H}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			return color.OKLCH{L: 0.82, C: clampF(lch.C, 0.10, 0.18), H: lch.H}
		},
	}
	stagger := [6]float64{-0.03, +0.01, +0.04, -0.02, -0.01, +0.02}

	palette := transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, stagger)

	for i := 1; i <= 6; i++ {
		if color.ContrastRatio(palette[0], palette[i]) >= MinHighContrastRatio {
			continue
		}
		palette[i] = boostContrastAgainstBg(palette[i], palette[0], MinHighContrastRatio)
		palette[i+8] = GenerateBrightVersion(palette[i])
	}
	return palette
}

// GenerateDuotonePalette: only two hues (base + 180° complement) at varying lightness.
// Stricter than complementary — no per-slot hue offsets, lower chroma. Reads as a true
// two-tone palette where structure comes entirely from lightness.
func GenerateDuotonePalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	compHue := math.Mod(baseHue+180, 360)

	var palette [16]string
	if lightMode {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: 0.97, C: 0.008, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: 0.20, C: 0.025, H: baseHue})
	} else {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: 0.12, C: 0.018, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: 0.90, C: 0.020, H: baseHue})
	}

	// Three lightness levels per hue, alternating base/comp/base/comp/base/comp.
	lightnessLevels := [6]float64{-0.10, -0.10, +0.04, +0.04, +0.14, +0.14}
	hues := [6]float64{baseHue, compHue, baseHue, compHue, baseHue, compHue}
	chroma := 0.09
	lightnessBase := 0.62
	if lightMode {
		lightnessBase = 0.50
	}

	for i := 0; i < 6; i++ {
		l := clampF(lightnessBase+lightnessLevels[i], 0.30, 0.85)
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: l, C: chroma, H: hues[i]})
	}

	finalizePalette(&palette)
	return palette
}
