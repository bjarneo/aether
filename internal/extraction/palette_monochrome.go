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
// using weighted circular mean in OKLCH space. Colors with more chroma get
// more weight.
//
// Returns:
//   - hue: mean tint direction (degrees, 0-360), undefined when hasTint=false.
//   - hasTint: true when the image has a meaningful color cast above
//     the JPEG-noise floor. A near-grayscale JPEG may still have a few
//     samples with chroma 0.003-0.008 from compression artifacts; treating
//     those as "tint" produces a blue palette from a black-and-white photo.
//   - tintStrength: how strongly the tint manifests, computed as
//     concentration * average chroma. concentration alone identifies a
//     tightly-clustered cast (sepia, blueprint) but doesn't distinguish it
//     from clustered noise; multiplying by chroma weights real color above
//     JPEG-grade noise. In [0, ~0.3] for realistic inputs.
func detectMonochromeTint(colors []string) (hue float64, hasTint bool, tintStrength float64) {
	if len(colors) == 0 {
		return 0, false, 0
	}
	var sinSum, cosSum float64
	var chromaSum float64

	for _, c := range colors {
		lch := color.HexToOKLCH(c)
		if lch.C > 0.005 { // Has any chroma at all
			weight := lch.C // Weight by chroma so stronger tints dominate
			rad := lch.H * math.Pi / 180
			sinSum += math.Sin(rad) * weight
			cosSum += math.Cos(rad) * weight
			chromaSum += weight
		}
	}

	// Average chroma across ALL dominant samples (not just the chromatic
	// ones). A near-grayscale image dominated by C≈0 pixels yields a very
	// low average even if its handful of noisy samples cluster perfectly.
	avgChroma := chromaSum / float64(len(colors))
	if avgChroma < MinMeaningfulTintChroma {
		return 0, false, 0
	}

	meanSin := sinSum / chromaSum
	meanCos := cosSum / chromaSum
	avgHue := math.Mod(math.Atan2(meanSin, meanCos)*180/math.Pi+360, 360)
	concentration := math.Sqrt(meanSin*meanSin + meanCos*meanCos)
	return avgHue, true, concentration * avgChroma
}

// applyTint applies tint influence to an OKLCH hue based on the image's
// dominant tone, at the strength used by the auto-detected monochrome path.
func applyTint(ansiHue, tintHue float64, hasTint bool) float64 {
	return applyTintStrength(ansiHue, tintHue, hasTint, MonochromeTintStrength)
}

// applyTintStrength is the parameterised form: `strength` is in [0, 1] where
// 0 leaves the canonical ANSI hue alone and 1 snaps fully to the image hue.
// The explicit `monochromatic` mode uses a higher strength to produce a
// stronger unified mood while keeping ANSI slots distinguishable.
func applyTintStrength(ansiHue, tintHue float64, hasTint bool, strength float64) float64 {
	if !hasTint {
		return ansiHue
	}
	hueDiff := math.Mod(tintHue-ansiHue+540, 360) - 180
	return math.Mod(ansiHue+hueDiff*strength+360, 360)
}

// GenerateMonochromePalette generates a palette for auto-detected monochrome
// images. Two-way split:
//
//   - hasTint=false: fully achromatic (B&W JPEGs, line art) → pure grayscale.
//   - hasTint=true:  has a real color cast (sepia, blueprint, faint blue
//     pixel art, themed wallpaper) → strong-tint generator.
//
// The previous middle "subdued rainbow at chroma 0.06" path was removed
// because users perceived it as wrong: an image they read as monochrome
// produced six visibly-different hues. detectMonochromeTint's
// MinMeaningfulTintChroma floor already filters out JPEG-noise tints, so
// anything reaching the tinted branch is something the user wants
// reflected as a unified mono mood.
func GenerateMonochromePalette(grayColors []string, lightMode bool) [16]string {
	tintHue, hasTint, _ := detectMonochromeTint(grayColors)
	if !hasTint {
		return generateGrayscaleMonochromaticPalette(grayColors, lightMode)
	}
	return generateTintedMonochromaticPalette(grayColors, lightMode, tintHue)
}

// GenerateMonochromaticPalette generates a monochromatic-mood ANSI palette
// keyed on the image's dominant hue. Background, foreground, the comment
// gray, and the high-contrast endpoint sit on the base hue (the "mono"
// feel), and the 6 ANSI slots use canonical hue targets pulled strongly
// toward the base hue — so red still reads as red and green still reads as
// green, just biased toward the image's tone.
//
// For fully achromatic images (B&W photos, line art, grayscale renders),
// detectMonochromeTint returns hasTint=false; we fall through to a true
// grayscale palette so the result actually feels monochrome instead of
// arbitrarily pulling every ANSI slot toward extractDominantHue's red
// fallback.
func GenerateMonochromaticPalette(dominantColors []string, lightMode bool) [16]string {
	tintHue, hasTint, _ := detectMonochromeTint(dominantColors)
	if !hasTint {
		return generateGrayscaleMonochromaticPalette(dominantColors, lightMode)
	}
	return generateTintedMonochromaticPalette(dominantColors, lightMode, tintHue)
}

// generateGrayscaleMonochromaticPalette builds a pure-grayscale palette for
// images with no usable hue. ANSI 1-6 are a lightness stair of neutral grays
// rather than tinted versions of canonical hues — for a true B&W source the
// "mono" mood IS the absence of color.
func generateGrayscaleMonochromaticPalette(dominantColors []string, lightMode bool) [16]string {
	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	if lightMode {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.94, lightest.Lightness), C: 0, H: 0})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.22, darkest.Lightness), C: 0, H: 0})
	} else {
		palette[0] = color.OKLCHToHex(color.OKLCH{L: math.Min(0.14, darkest.Lightness), C: 0, H: 0})
		palette[7] = color.OKLCHToHex(color.OKLCH{L: math.Max(0.88, lightest.Lightness), C: 0, H: 0})
	}

	// Lightness stair for ANSI 1-6. Distinguishable by L only.
	lightnessStair := [6]float64{0.35, 0.45, 0.55, 0.65, 0.75, 0.85}
	if lightMode {
		// Mirror around 0.5 so darker grays still contrast against light bg.
		lightnessStair = [6]float64{0.65, 0.55, 0.45, 0.35, 0.25, 0.15}
	}
	for i := 0; i < 6; i++ {
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: lightnessStair[i], C: 0, H: 0})
	}

	palette[8] = generateCommentColor(palette[0])

	// Bright variants: nudge toward the high-contrast end of the stair.
	for i := 0; i < 6; i++ {
		bump := 0.08
		if lightMode {
			bump = -0.08
		}
		l := math.Max(0.05, math.Min(0.95, lightnessStair[i]+bump))
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: l, C: 0, H: 0})
	}

	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.04, C: 0, H: 0})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.99, C: 0, H: 0})
	}

	return palette
}

// generateTintedMonochromaticPalette is the chromatic path: there's a real
// tint to anchor the mood, so ANSI 1-6 use canonical hues pulled toward it.
// Bg / fg are derived from the actual image colors via synthesizeMonoBgIfMuddy,
// which keeps themed-wallpaper backgrounds (Nord L≈0.30, Tokyo Night L≈0.21,
// solarized L≈0.85) intact and only synthesizes a near-black/near-white bg
// when the image's bg is genuinely too muddy to use as-is.
func generateTintedMonochromaticPalette(dominantColors []string, lightMode bool, baseHue float64) [16]string {
	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	// Bg / fg: prefer image-derived colors, only synthesize when muddy.
	// This preserves authored themed-wallpaper backgrounds in mono mode.
	if lightMode {
		palette[0] = synthesizeMonoBgIfMuddy(lightest.Color, lightMode)
		palette[7] = darkest.Color
	} else {
		palette[0] = synthesizeMonoBgIfMuddy(darkest.Color, lightMode)
		palette[7] = lightest.Color
	}

	// Contrast guard for pathological inputs (gray photos where darkest and
	// lightest are close together): if fg/bg contrast is below the readable
	// floor, force fg toward the opposite extreme.
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

	// ANSI 1-6: canonical hues pulled strongly toward the base hue.
	chromaLevels := [6]float64{0.09, 0.11, 0.13, 0.10, 0.12, 0.14}
	lightnessOffsets := [6]float64{-0.08, -0.02, +0.04, +0.10, -0.05, +0.07}
	lightnessBase := 0.62
	if lightMode {
		lightnessBase = 0.50
	}

	for i := 0; i < 6; i++ {
		lightness := math.Max(0.30, math.Min(0.85, lightnessBase+lightnessOffsets[i]))
		hue := applyTintStrength(OKLCHAnsiHues[i], baseHue, true, MonochromaticTintStrength)
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: lightness, C: chromaLevels[i], H: hue})
	}

	palette[8] = generateCommentColor(palette[0])

	brightChromaLevels := [6]float64{0.11, 0.14, 0.16, 0.12, 0.15, 0.17}
	for i := 0; i < 6; i++ {
		baseLightness := lightnessBase + lightnessOffsets[i]
		adjustment := 0.10
		if lightMode {
			adjustment = -0.10
		}
		lightness := math.Max(0.20, math.Min(0.92, baseLightness+adjustment))
		hue := applyTintStrength(OKLCHAnsiHues[i], baseHue, true, MonochromaticTintStrength)
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: lightness, C: brightChromaLevels[i], H: hue})
	}

	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.08, C: 0.03, H: baseHue})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.97, C: 0.015, H: baseHue})
	}

	return palette
}
