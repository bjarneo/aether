package extraction

import (
	"math"

	"aether/internal/color"
)

// extractChromaticHues fills slots 0 (bg), 7 (fg), and 1-6 (ANSI) using image-derived
// colors. Slots 8 and 9-15 are left empty — pass through finalizePalette to fill them.
// Mode transforms call this directly when they intend to overwrite bg/fg/ANSI in OKLCH,
// avoiding wasted slot 8/9-15 generation that the full chromatic pipeline would do.
func extractChromaticHues(dominantColors []string, lightMode bool) [16]string {
	topCount := 12
	if len(dominantColors) < topCount {
		topCount = len(dominantColors)
	}
	topColors := dominantColors[:topCount]

	// topColors is a prefix slice of dominantColors, so the index FindBackgroundColor
	// returns is valid in the full dominantColors list.
	bgColor, bgIndex := FindBackgroundColor(topColors, lightMode)
	bgColor = synthesizeBgIfTooMid(bgColor, lightMode)
	usedIndices := map[int]bool{bgIndex: true}

	fgColor, fgIndex := FindForegroundColor(dominantColors, lightMode, bgColor, usedIndices)
	if fgIndex >= 0 {
		usedIndices[fgIndex] = true
	}

	var palette [16]string
	palette[0] = bgColor
	palette[7] = fgColor

	assignments := FindOptimalAnsiAssignment(dominantColors, usedIndices, lightMode)

	var matchedColors []string
	synthesizedSlots := [6]bool{}
	for i := 0; i < 6; i++ {
		assignment := assignments[i]
		if assignment != nil && assignment.Score < SynthesisScoreThreshold {
			lch := color.HexToOKLCH(dominantColors[assignment.PoolIndex])
			if lch.C >= MinChromaForAnsiMatch {
				palette[i+1] = dominantColors[assignment.PoolIndex]
				matchedColors = append(matchedColors, palette[i+1])
				usedIndices[assignment.PoolIndex] = true
				continue
			}
		}
		synthesizedSlots[i] = true
	}

	// Stagger synthesized slots so they don't all share the same lightness — without
	// stagger, multiple synthesized slots end up at avgL with only hue differing,
	// which is hard to distinguish at low chroma.
	synthStagger := [6]float64{-0.06, +0.02, +0.07, -0.04, -0.02, +0.04}
	for i := 0; i < 6; i++ {
		if !synthesizedSlots[i] {
			continue
		}
		base := SynthesizeAnsiColor(OKLCHAnsiHues[i], matchedColors)
		lch := color.HexToOKLCH(base)
		lch.L = math.Max(0.30, math.Min(0.85, lch.L+synthStagger[i]))
		palette[i+1] = color.OKLCHToHex(lch)
		matchedColors = append(matchedColors, palette[i+1])
	}

	return palette
}

// synthesizeBgIfTooMid replaces a mid-lightness image bg with a synthesized OKLCH
// color at a sane bg lightness, preserving hue. Without this, images with no truly
// dark/light pixels (e.g. a sunset photo) produce muddy backgrounds.
func synthesizeBgIfTooMid(bgColor string, lightMode bool) string {
	lch := color.HexToOKLCH(bgColor)
	if lightMode {
		if lch.L >= 0.85 {
			return bgColor
		}
		return color.OKLCHToHex(color.OKLCH{L: 0.94, C: math.Min(lch.C, 0.025), H: lch.H})
	}
	if lch.L <= 0.20 {
		return bgColor
	}
	return color.OKLCHToHex(color.OKLCH{L: 0.12, C: math.Min(lch.C, 0.030), H: lch.H})
}

// GenerateChromaticPalette: vibrant chromatic palette from image-derived hues.
// OKLCH-based optimal assignment for slots 1-6, contrast-aware bg/fg, synthesized
// missing hues. finalizePalette derives slots 8/9-15 and enforces AA contrast.
func GenerateChromaticPalette(dominantColors []string, lightMode bool) [16]string {
	palette := extractChromaticHues(dominantColors, lightMode)
	finalizePalette(&palette)
	return palette
}

// generateCommentColor creates a gray/muted color for code comments (ANSI color 8)
// that has adequate contrast against the background.
func generateCommentColor(bgColor string) string {
	bgLab := color.HexToOKLab(bgColor)
	bgLch := color.OKLabToOKLCH(bgLab)

	var targetL float64
	if bgLab.L < 0.5 {
		// Dark background: comments should be medium-light gray
		targetL = math.Min(1.0, bgLab.L+0.30)
	} else {
		// Light background: comments should be medium-dark gray
		targetL = math.Max(0.0, bgLab.L-0.30)
	}

	// Subtle tint from background hue for cohesion
	commentChroma := 0.01
	commentColor := color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})

	// Verify contrast; adjust if needed
	contrast := color.ContrastRatio(bgColor, commentColor)
	if contrast < MinCommentContrast {
		step := 0.05
		if bgLab.L < 0.5 {
			for targetL < 0.95 && contrast < MinCommentContrast {
				targetL += step
				commentColor = color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})
				contrast = color.ContrastRatio(bgColor, commentColor)
			}
		} else {
			for targetL > 0.05 && contrast < MinCommentContrast {
				targetL -= step
				commentColor = color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})
				contrast = color.ContrastRatio(bgColor, commentColor)
			}
		}
	}

	return commentColor
}

// boostContrastAgainstBg adjusts a color's OKLab lightness until it meets targetRatio
// against the background, preserving hue and chroma.
func boostContrastAgainstBg(hex, bgColor string, targetRatio float64) string {
	lab := color.HexToOKLab(hex)
	lch := color.OKLabToOKLCH(lab)
	bgLab := color.HexToOKLab(bgColor)

	step := 0.03
	if bgLab.L < 0.5 {
		for lch.L < 0.95 {
			lch.L += step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= targetRatio {
				return candidate
			}
		}
	} else {
		for lch.L > 0.05 {
			lch.L -= step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= targetRatio {
				return candidate
			}
		}
	}

	return color.OKLCHToHex(lch)
}
