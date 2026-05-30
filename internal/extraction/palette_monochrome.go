package extraction

import (
	"math"
	"sort"

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

// salientChroma returns a high-percentile (~90th) OKLCH chroma across the dominant
// colors: a robust proxy for the saturation of the image's most colorful regions.
//
// Using a high percentile rather than the mean is deliberate. A small but vivid
// accent (a logo, a neon sign, a sliver of sky) covers few pixels and is drowned
// out by a mean, yet it carries the image's chromatic identity, so the palette's
// accents should match its saturation. The 90th percentile keeps that accent
// influential while ignoring a lone noise outlier (the absolute max could be a
// single JPEG-artifact bucket). For a genuinely gray image every bucket is near
// zero, so the percentile is near zero too and the accents stay muted.
func salientChroma(colors []string) float64 {
	if len(colors) == 0 {
		return 0
	}
	chromas := make([]float64, len(colors))
	for i, c := range colors {
		chromas[i] = color.HexToOKLCH(c).C
	}
	sort.Float64s(chromas)
	idx := int(math.Round(0.9 * float64(len(chromas)-1)))
	return chromas[idx]
}

func mean6(v [6]float64) float64 {
	var sum float64
	for _, x := range v {
		sum += x
	}
	return sum / 6
}

// monoChromaFactor maps the image's salient chroma to a [floor, 1.0] scale applied
// to the canonical mono ANSI chroma arrays. refMean is the mean of those arrays, so
// an image whose colorful regions are as saturated as a vivid terminal slot yields
// factor 1.0 (full vivid accents); near-gray sources scale down toward
// MonoChromaFactorFloor. Using salientChroma (a high percentile) rather than the
// mean means a small vivid accent still produces saturated accents in its hue
// family, while a truly flat-gray image produces muted ones.
func monoChromaFactor(dominantColors []string, refMean float64) float64 {
	return clampF(salientChroma(dominantColors)/refMean, MonoChromaFactorFloor, 1.0)
}

// foldHueIntoArc maps a canonical ANSI hue into an arc of half-width arcDeg centered
// on the image's base hue, preserving the six canonical hues' circular order. A hue
// equal to the base lands on the base; the hue diametrically opposite the base lands
// at the arc edge (base +/- arcDeg). This "wraps the whole spectrum into the image's
// color family": a warm image yields six warm accents (no jarring teal or purple
// from rotating a far-side canonical hue), a cool image six cool ones, and the six
// stay ordered and lightness-separated so syntax highlighting remains legible.
//
// This replaces the older rotate-toward-base-then-clamp approach (applyTintStrength
// + MaxAnsiTintShift), which moved each canonical hue at most 30 degrees toward the
// base. That worked for hues near the base but, for a canonical hue ~180 degrees away
// (blue/cyan/magenta on a warm image), a 30 degree nudge landed in purple/teal:
// visually unrelated to the wallpaper. Folding guarantees every accent stays inside
// the image's family regardless of how far the canonical hue started.
func foldHueIntoArc(canonicalHue, baseHue, arcDeg float64) float64 {
	d := math.Mod(canonicalHue-baseHue+540, 360) - 180 // signed angular offset [-180,180]
	return math.Mod(baseHue+(d/180.0)*arcDeg+360, 360)
}

// canonicalLightnessOrder lists the ANSI slot indices (into OKLCHAnsiHues) ordered
// by the natural OKLab lightness of their pure-primary hue: blue darkest, then red,
// magenta, green, cyan, yellow lightest. The tinted-mono accents are spread along an
// even lightness ramp in this order, so the familiar "blue is dark, yellow is bright"
// relationship from real terminal palettes survives — and, because the fold packs
// the six hues into one narrow family, this even lightness ramp is what actually
// keeps the slots mutually distinguishable for syntax highlighting.
var canonicalLightnessOrder = [6]int{3, 0, 4, 1, 5, 2}

// monoAccentRamp returns the OKLab lightness for each of the six ANSI accent slots
// (indexed by slot, not ramp position) for a monochrome palette on background bg.
// The ramp starts just past the AA-readable threshold and steps outward by at least
// MonoAccentMinLStep per slot, assigning lightnesses in canonicalLightnessOrder so
// blue stays darkest and yellow brightest. The guaranteed step keeps the six slots
// distinguishable regardless of how much readable headroom the background leaves.
func monoAccentRamp(bg string, lightMode bool) [6]float64 {
	var start, step float64
	if lightMode {
		hi := neutralReadableL(bg, true, MinContrastRatio) - 0.02 // readable dark ceiling
		start = hi
		step = -math.Max(MonoAccentMinLStep, (hi-0.16)/5.0) // descend toward dark
	} else {
		lo := neutralReadableL(bg, false, MinContrastRatio) + 0.02 // readable light floor
		start = lo
		step = math.Max(MonoAccentMinLStep, (0.92-lo)/5.0) // ascend toward bright
	}
	var slotL [6]float64
	for pos, slot := range canonicalLightnessOrder {
		slotL[slot] = clampF(start+step*float64(pos), 0.06, 0.97)
	}
	return slotL
}

// ensureMonoHeadroom darkens (dark mode) or lightens (light mode) a monochrome
// background just enough that the six-step accent ramp has room to stay distinct.
// On a mid-toned background the readable lightness band is so narrow that the ramp's
// upper steps clamp together (e.g. a deep-blue wallpaper whose bg sits at L≈0.30
// produced three near-identical pale-cyan accents). It only fires when the image bg
// genuinely lacks headroom, so already-deep backgrounds (Tokyo Night ~0.21) and
// already-light ones are preserved with their tone intact.
func ensureMonoHeadroom(bg string, lightMode bool) string {
	lch := color.HexToOKLCH(bg)
	if lightMode {
		if neutralReadableL(bg, true, MinContrastRatio) < 0.42 {
			return color.OKLCHToHex(color.OKLCH{L: 0.95, C: math.Min(lch.C, 0.04), H: lch.H})
		}
		return bg
	}
	if neutralReadableL(bg, false, MinContrastRatio) > 0.60 {
		return color.OKLCHToHex(color.OKLCH{L: 0.13, C: math.Min(lch.C, 0.06), H: lch.H})
	}
	return bg
}

// GenerateMonochromePalette generates a palette for auto-detected monochrome
// images. Two-way split:
//
//   - hasTint=false: fully achromatic (B&W JPEGs, line art) → pure grayscale.
//   - hasTint=true:  has a real color cast (sepia, blueprint, faint blue
//     pixel art, themed wallpaper) → tinted generator, accents folded into the
//     image's color family.
//
// The auto path uses a wider fold arc (AutoMonoArcDeg) than the explicit
// `monochromatic` mode: an auto-detected mono image may still have a little
// hue variety the user expects to see, so the six accents fan out more across
// the family. detectMonochromeTint's MinMeaningfulTintChroma floor filters out
// JPEG-noise tints, so anything reaching the tinted branch is a real cast the
// user wants reflected.
func GenerateMonochromePalette(grayColors []string, lightMode bool) [16]string {
	tintHue, hasTint, _ := detectMonochromeTint(grayColors)
	if !hasTint {
		return generateGrayscaleMonochromaticPalette(grayColors, lightMode)
	}
	return generateTintedMonochromaticPalette(grayColors, lightMode, tintHue, AutoMonoArcDeg)
}

// GenerateMonochromaticPalette generates a monochromatic-mood ANSI palette
// keyed on the image's dominant hue. Background, foreground, the comment gray,
// and the high-contrast endpoint sit on the base hue (the "mono" feel), and the
// 6 ANSI slots fold the canonical hues into a tight arc (ExplicitMonoArcDeg)
// around the base hue — so the whole palette reads as one cohesive color family,
// with the six slots kept distinct by lightness and a small in-family hue spread.
//
// For fully achromatic images (B&W photos, line art, grayscale renders),
// detectMonochromeTint returns hasTint=false; we fall through to a true
// grayscale palette so the result actually feels monochrome instead of
// arbitrarily pulling every ANSI slot toward a red fallback.
func GenerateMonochromaticPalette(dominantColors []string, lightMode bool) [16]string {
	tintHue, hasTint, _ := detectMonochromeTint(dominantColors)
	if !hasTint {
		return generateGrayscaleMonochromaticPalette(dominantColors, lightMode)
	}
	return generateTintedMonochromaticPalette(dominantColors, lightMode, tintHue, ExplicitMonoArcDeg)
}

// neutralReadableL scans neutral-gray lightness away from the background and
// returns the first L that clears `ratio` contrast against it (upward for a dark
// bg, downward for a light bg). It anchors the grayscale ramp so every step is
// guaranteed readable before the ramp is even built — see the note in
// generateGrayscaleMonochromaticPalette about why a fixed stair collapsed.
func neutralReadableL(bg string, lightMode bool, ratio float64) float64 {
	gray := func(l float64) string { return color.OKLCHToHex(color.OKLCH{L: l, C: 0, H: 0}) }
	if !lightMode { // dark bg: lighten until readable
		for l := 0.20; l <= 0.95; l += 0.01 {
			if color.ContrastRatio(bg, gray(l)) >= ratio {
				return l
			}
		}
		return 0.55
	}
	for l := 0.80; l >= 0.05; l -= 0.01 { // light bg: darken until readable
		if color.ContrastRatio(bg, gray(l)) >= ratio {
			return l
		}
	}
	return 0.45
}

// generateGrayscaleMonochromaticPalette builds a pure-grayscale palette for
// images with no usable hue. ANSI 1-6 are a lightness ramp of neutral grays
// rather than tinted versions of canonical hues — for a true B&W source the
// "mono" mood IS the absence of color.
//
// The ramp is anchored to the lightness that first clears AA contrast against
// the background, then spread evenly to the readable extreme. The old fixed
// [0.35..0.85] stair collapsed on a near-black background: its 0.35/0.45 steps
// fell below 4.5:1, and the downstream NormalizeBrightness pass clamped them all
// up to the same minimum-readable gray — leaving the bottom three ANSI slots
// nearly identical. Anchoring to neutralReadableL keeps all six readable and
// evenly spaced, so they stay mutually distinguishable for syntax highlighting.
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

	// Neutral lightness ramp with a guaranteed minimum step (shared with the tinted
	// path). The grayscale bg is already near-extreme, but run the headroom guard for
	// symmetry with the tinted path.
	palette[0] = ensureMonoHeadroom(palette[0], lightMode)
	// path) so the six grays stay distinct and all clear AA contrast against bg.
	slotL := monoAccentRamp(palette[0], lightMode)
	for i := 0; i < 6; i++ {
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: slotL[i], C: 0, H: 0})
	}

	palette[8] = generateCommentColor(palette[0])

	// Bright variants: parallel ramp nudged toward the high-contrast extreme.
	bump := 0.06
	if lightMode {
		bump = -0.06
	}
	for i := 0; i < 6; i++ {
		l := math.Max(0.05, math.Min(0.97, slotL[i]+bump))
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: l, C: 0, H: 0})
	}

	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.04, C: 0, H: 0})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.99, C: 0, H: 0})
	}

	return palette
}

// generateTintedMonochromaticPalette is the chromatic mono path: there's a real
// tint to anchor the mood, so ANSI 1-6 fold the canonical hues into an arc of
// half-width arcDeg around the image's base hue (see foldHueIntoArc) — every
// accent stays inside the wallpaper's color family. Bg / fg are derived from the
// actual image colors via synthesizeMonoBgIfMuddy, which keeps themed-wallpaper
// backgrounds (Nord L≈0.30, Tokyo Night L≈0.21, solarized L≈0.85) intact and only
// synthesizes a near-black/near-white bg when the image's bg is genuinely too
// muddy to use as-is.
func generateTintedMonochromaticPalette(dominantColors []string, lightMode bool, baseHue, arcDeg float64) [16]string {
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
	// Guarantee the accent ramp has lightness headroom (avoids the upper steps
	// clamping together on a mid-toned background).
	palette[0] = ensureMonoHeadroom(palette[0], lightMode)

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

	// ANSI 1-6: canonical hues folded into the base-hue family (foldHueIntoArc),
	// chroma scaled toward the image's salient saturation (chromaFactor) so a
	// near-grayscale image stays muted while a vividly-colored one keeps full
	// saturation. Lightness is an even ramp from the readable threshold to the
	// bright end, assigned in canonical-lightness order — this is what keeps the
	// six slots distinguishable now that the fold packs their hues together.
	chromaLevels := [6]float64{0.09, 0.11, 0.13, 0.10, 0.12, 0.14}
	brightChromaLevels := [6]float64{0.11, 0.14, 0.16, 0.12, 0.15, 0.17}
	chromaFactor := monoChromaFactor(dominantColors, mean6(chromaLevels))

	// Accent lightness ramp. It starts just past the lightness that clears AA
	// contrast against bg (so NormalizeBrightness has nothing to clamp) and steps
	// outward with a GUARANTEED minimum step (MonoAccentMinLStep), so the six slots
	// stay mutually distinguishable even when the background is mid-toned and the
	// natural readable range is narrow. Without the floor, a medium-gray bg leaves
	// almost no readable headroom and all six accents bunch into a few L values.
	slotL := monoAccentRamp(palette[0], lightMode)

	for i := 0; i < 6; i++ {
		hue := foldHueIntoArc(OKLCHAnsiHues[i], baseHue, arcDeg)
		palette[i+1] = color.OKLCHToHex(color.OKLCH{L: slotL[i], C: chromaLevels[i] * chromaFactor, H: hue})
	}

	palette[8] = generateCommentColor(palette[0])

	brightAdj := 0.07
	if lightMode {
		brightAdj = -0.07
	}
	for i := 0; i < 6; i++ {
		hue := foldHueIntoArc(OKLCHAnsiHues[i], baseHue, arcDeg)
		l := clampF(slotL[i]+brightAdj, 0.18, 0.96)
		palette[i+9] = color.OKLCHToHex(color.OKLCH{L: l, C: brightChromaLevels[i] * chromaFactor, H: hue})
	}

	if lightMode {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.08, C: 0.03, H: baseHue})
	} else {
		palette[15] = color.OKLCHToHex(color.OKLCH{L: 0.97, C: 0.015, H: baseHue})
	}

	return palette
}
