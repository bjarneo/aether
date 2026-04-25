package extraction

import (
	"math"

	"aether/internal/color"
)

// schemeBackground synthesizes near-extreme bg/fg colors with a subtle hue tint.
// Used by color-theory schemes (complementary/triadic) where the background should
// recede and let the structural hue relationships do the visual work.
func schemeBackground(baseHue float64, lightMode bool) (bg, fg string) {
	if lightMode {
		bg = color.OKLCHToHex(color.OKLCH{L: 0.96, C: 0.012, H: baseHue})
		fg = color.OKLCHToHex(color.OKLCH{L: 0.22, C: 0.04, H: baseHue})
	} else {
		bg = color.OKLCHToHex(color.OKLCH{L: 0.13, C: 0.022, H: baseHue})
		fg = color.OKLCHToHex(color.OKLCH{L: 0.88, C: 0.025, H: baseHue})
	}
	return
}

// buildSchemePalette assembles a 16-color palette from per-slot (hue, chroma, lightness)
// triples for the six ANSI slots, then derives bg/fg/8/9-15 against the chosen base hue.
func buildSchemePalette(baseHue float64, lightMode bool, hues, chromas, lightnessOffsets [6]float64) [16]string {
	lightnessBase := 0.65
	if lightMode {
		lightnessBase = 0.48
	}

	var palette [16]string
	palette[0], palette[7] = schemeBackground(baseHue, lightMode)

	for i := 0; i < 6; i++ {
		l := clampF(lightnessBase+lightnessOffsets[i], 0.30, 0.85)
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: l, C: chromas[i], H: math.Mod(hues[i]+360, 360)})
	}

	finalizePalette(&palette)
	return palette
}

// GenerateComplementaryPalette: alternating base hue and 180° opposite across slots 1-6.
// Two-tone identity with strong visual contrast (e.g., teal/orange terminals).
func GenerateComplementaryPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	compHue := math.Mod(baseHue+180, 360)

	hues := [6]float64{
		baseHue - 8, compHue - 8,
		baseHue, compHue,
		baseHue + 8, compHue + 8,
	}
	chromas := [6]float64{0.14, 0.14, 0.11, 0.11, 0.16, 0.16}
	lightnessOffsets := [6]float64{-0.06, -0.04, +0.04, +0.02, +0.08, +0.06}

	return buildSchemePalette(baseHue, lightMode, hues, chromas, lightnessOffsets)
}

// GenerateTriadicPalette: three hues at 120° spacing, two slots per hue at varying lightness.
// Balanced, classical color theory; rotates around the wheel evenly.
func GenerateTriadicPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	h2 := math.Mod(baseHue+120, 360)
	h3 := math.Mod(baseHue+240, 360)

	hues := [6]float64{baseHue, h2, h3, baseHue, h2, h3}
	chromas := [6]float64{0.13, 0.13, 0.13, 0.16, 0.16, 0.16}
	lightnessOffsets := [6]float64{+0.05, +0.05, +0.05, -0.07, -0.07, -0.07}

	return buildSchemePalette(baseHue, lightMode, hues, chromas, lightnessOffsets)
}

// GenerateSplitComplementaryPalette: base hue plus the two hues 30° either side of its
// complement. Softer than pure complementary, three structural anchors instead of two.
func GenerateSplitComplementaryPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	h2 := math.Mod(baseHue+150, 360)
	h3 := math.Mod(baseHue+210, 360)

	hues := [6]float64{baseHue, h2, h3, baseHue, h2, h3}
	chromas := [6]float64{0.14, 0.13, 0.13, 0.17, 0.16, 0.16}
	lightnessOffsets := [6]float64{+0.05, +0.05, +0.05, -0.06, -0.06, -0.06}

	return buildSchemePalette(baseHue, lightMode, hues, chromas, lightnessOffsets)
}

// GenerateTetradicPalette: four hues at 90° spacing (a rectangle on the color wheel),
// with the fifth and sixth slots reusing two of them at brighter lightness.
func GenerateTetradicPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	h2 := math.Mod(baseHue+90, 360)
	h3 := math.Mod(baseHue+180, 360)
	h4 := math.Mod(baseHue+270, 360)

	hues := [6]float64{baseHue, h2, h3, h4, baseHue, h3}
	// Slightly lower chroma overall — tetradic risks clashing if every slot is max chroma.
	chromas := [6]float64{0.12, 0.12, 0.12, 0.12, 0.15, 0.15}
	lightnessOffsets := [6]float64{+0.04, -0.02, +0.04, -0.02, +0.10, +0.10}

	return buildSchemePalette(baseHue, lightMode, hues, chromas, lightnessOffsets)
}
