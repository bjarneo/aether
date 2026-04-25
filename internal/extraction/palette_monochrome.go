package extraction

import (
	"math"

	"aether/internal/color"
)

// synthesizeMonoBgIfMuddy is a more conservative variant of synthesizeBgIfTooMid for
// the monochrome path. It only kicks in when the image bg is clearly muddy
// (L > 0.35 in dark mode, < 0.75 in light mode), preserving the iconic muted
// backgrounds of themed wallpapers like Nord (L≈0.32) or Tokyo Night (L≈0.21).
func synthesizeMonoBgIfMuddy(bgColor string, lightMode bool) string {
	lch := color.HexToOKLCH(bgColor)
	if lightMode {
		if lch.L >= 0.75 {
			return bgColor
		}
		return color.OKLCHToHex(color.OKLCH{L: 0.94, C: math.Min(lch.C, 0.04), H: lch.H})
	}
	if lch.L <= 0.35 {
		return bgColor
	}
	return color.OKLCHToHex(color.OKLCH{L: 0.14, C: math.Min(lch.C, 0.06), H: lch.H})
}

// detectMonochromeTint detects the dominant tint hue from mostly-gray colors
// using weighted circular mean in OKLCH space. Colors with more chroma get more weight.
func detectMonochromeTint(colors []string) (hue float64, hasTint bool) {
	var sinSum, cosSum float64
	var totalWeight float64

	for _, c := range colors {
		lch := color.HexToOKLCH(c)
		if lch.C > 0.005 { // Has any chroma at all
			weight := lch.C // Weight by chroma so stronger tints dominate
			rad := lch.H * math.Pi / 180
			sinSum += math.Sin(rad) * weight
			cosSum += math.Cos(rad) * weight
			totalWeight += weight
		}
	}

	if totalWeight < 0.001 {
		return 0, false
	}

	avgHue := math.Mod(math.Atan2(sinSum/totalWeight, cosSum/totalWeight)*180/math.Pi+360, 360)
	return avgHue, true
}

// applyTint applies tint influence to an OKLCH hue based on the image's dominant tone.
func applyTint(ansiHue, tintHue float64, hasTint bool) float64 {
	if !hasTint {
		return ansiHue
	}
	hueDiff := math.Mod(tintHue-ansiHue+540, 360) - 180
	return math.Mod(ansiHue+hueDiff*MonochromeTintStrength+360, 360)
}

// GenerateMonochromePalette generates a monochrome ANSI palette with distinguishable
// hue-tinted colors. Uses OKLCH hue targets at subdued chroma so colors remain
// functional for syntax highlighting while matching the monochrome mood.
func GenerateMonochromePalette(grayColors []string, lightMode bool) [16]string {
	sortedByLightness := SortColorsByLightness(grayColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]
	tintHue, hasTint := detectMonochromeTint(grayColors)

	var palette [16]string

	// Mono path treats the image AS the theme — keep image-derived bg unless it's
	// genuinely muddy (L > 0.35 dark / < 0.75 light), so themed wallpapers
	// (Nord, Tokyo Night, etc.) keep their authentic colors.
	if lightMode {
		palette[0] = synthesizeMonoBgIfMuddy(lightest.Color, lightMode)
		palette[7] = darkest.Color
	} else {
		palette[0] = synthesizeMonoBgIfMuddy(darkest.Color, lightMode)
		palette[7] = lightest.Color
	}

	if color.ContrastRatio(palette[0], palette[7]) < MinFgBgContrast {
		bgLab := color.HexToOKLab(palette[0])
		fgLab := color.HexToOKLab(palette[7])
		if bgLab.L < 0.5 {
			fgLab.L = 0.97
		} else {
			fgLab.L = 0.05
		}
		palette[7] = color.OKLabToHex(fgLab)
	}

	// ANSI colors 1-6: use OKLCH hue targets with subdued chroma, tinted toward image tone
	lightnessBase := 0.62
	if lightMode {
		lightnessBase = 0.48
	}
	for i := 0; i < len(OKLCHAnsiHues); i++ {
		hue := applyTint(OKLCHAnsiHues[i], tintHue, hasTint)
		lightness := lightnessBase + (float64(i)-2.5)*0.03
		chroma := 0.06 // Subdued but visible for syntax highlighting
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: lightness, C: chroma, H: hue})
	}

	// Color 8: neutral gray for comments with guaranteed contrast
	palette[8] = generateCommentColor(palette[0])

	// Colors 9-14: brighter, slightly more chromatic versions of 1-6
	for i := 0; i < len(OKLCHAnsiHues); i++ {
		hue := applyTint(OKLCHAnsiHues[i], tintHue, hasTint)
		baseLightness := lightnessBase + (float64(i)-2.5)*0.03
		adjustment := 0.05
		if lightMode {
			adjustment = -0.05
		}
		lightness := math.Max(0, math.Min(1, baseLightness+adjustment))
		chroma := 0.08 // Slightly more chromatic than base
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: lightness, C: chroma, H: hue})
	}

	// Color 15: near-white or near-black
	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.05, darkest.Lightness-0.05), C: 0.01, H: tintHue})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.98, lightest.Lightness+0.05), C: 0.01, H: tintHue})
	}

	return palette
}

// GenerateMonochromaticPalette generates a monochromatic ANSI palette based on
// the dominant hue from the image, with all colors sharing that hue at varying
// chroma and lightness levels.
func GenerateMonochromaticPalette(dominantColors []string, lightMode bool) [16]string {
	baseHue := extractDominantHue(dominantColors)
	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	if lightMode {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.90, lightest.Lightness), C: 0.015, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.30, darkest.Lightness+0.05), C: 0.04, H: baseHue})
	} else {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.18, darkest.Lightness), C: 0.025, H: baseHue})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.85, lightest.Lightness-0.05), C: 0.02, H: baseHue})
	}

	// Colors 1-6: chroma stair from subtle to vivid, all at the same hue.
	// Spread is 0.06–0.18 (well above OKLCH JND ~0.02) so slots are visibly distinct.
	chromaLevels := [6]float64{0.06, 0.10, 0.14, 0.08, 0.12, 0.18}
	lightnessOffsets := [6]float64{-0.08, -0.02, +0.04, +0.10, -0.05, +0.07}
	lightnessBase := 0.62
	if lightMode {
		lightnessBase = 0.50
	}

	for i := 0; i < 6; i++ {
		lightness := math.Max(0.30, math.Min(0.85, lightnessBase+lightnessOffsets[i]))
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: lightness, C: chromaLevels[i], H: baseHue})
	}

	// Color 8: comment gray
	palette[8] = generateCommentColor(palette[0])

	// Colors 9-14: brighter versions
	brightChromaLevels := [6]float64{0.09, 0.13, 0.17, 0.11, 0.15, 0.20}
	for i := 0; i < 6; i++ {
		baseLightness := lightnessBase + lightnessOffsets[i]
		adjustment := 0.10
		if lightMode {
			adjustment = -0.10
		}
		lightness := math.Max(0.20, math.Min(0.92, baseLightness+adjustment))
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: lightness, C: brightChromaLevels[i], H: baseHue})
	}

	// Color 15: maximum-contrast endpoint (near-white in dark mode, near-black in light mode)
	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.08, C: 0.03, H: baseHue})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.97, C: 0.015, H: baseHue})
	}

	return palette
}
