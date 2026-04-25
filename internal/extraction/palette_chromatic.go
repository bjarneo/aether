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
	usedIndices := map[int]bool{bgIndex: true}

	fgColor, fgIndex := FindForegroundColor(dominantColors, lightMode, bgColor, usedIndices)
	usedIndices[fgIndex] = true

	var palette [16]string
	palette[0] = bgColor
	palette[7] = fgColor

	assignments := FindOptimalAnsiAssignment(dominantColors, usedIndices)

	var matchedColors []string
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
		palette[i+1] = ""
	}

	for i := 0; i < 6; i++ {
		if palette[i+1] == "" {
			palette[i+1] = SynthesizeAnsiColor(OKLCHAnsiHues[i], matchedColors)
			matchedColors = append(matchedColors, palette[i+1])
		}
	}

	return palette
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
