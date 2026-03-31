package extraction

import (
	"math"

	"aether/internal/color"
)

// GenerateChromaticPalette generates a vibrant chromatic palette from diverse colors.
// Uses OKLCH-based optimal global assignment, contrast-aware bg/fg selection,
// and synthesizes missing hues in OKLab space.
func GenerateChromaticPalette(dominantColors []string, lightMode bool) [16]string {
	// Select background from top-dominant colors for better representation
	topCount := 12
	if len(dominantColors) < topCount {
		topCount = len(dominantColors)
	}
	topColors := dominantColors[:topCount]

	bgColor, _ := FindBackgroundColor(topColors, lightMode)
	// Find bgIndex in the full dominant colors list
	bgIndex := 0
	for i, c := range dominantColors {
		if c == bgColor {
			bgIndex = i
			break
		}
	}
	usedIndices := map[int]bool{bgIndex: true}

	// Contrast-aware foreground selection
	fgColor, fgIndex := FindForegroundColor(dominantColors, lightMode, bgColor, usedIndices)
	usedIndices[fgIndex] = true

	var palette [16]string
	palette[0] = bgColor
	palette[7] = fgColor

	// Use OKLCH-based global optimal assignment for ANSI colors 1-6
	assignments := FindOptimalAnsiAssignment(dominantColors, usedIndices)

	// Apply assignments, collecting matched colors for synthesis reference
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
		palette[i+1] = "" // Mark for synthesis
	}

	// Synthesize any missing ANSI colors in OKLCH space to match the palette's mood
	for i := 0; i < 6; i++ {
		if palette[i+1] == "" {
			palette[i+1] = SynthesizeAnsiColor(OKLCHAnsiHues[i], matchedColors)
			matchedColors = append(matchedColors, palette[i+1])
		}
	}

	// Ensure all ANSI colors have sufficient contrast against background
	for i := 1; i <= 6; i++ {
		contrast := color.ContrastRatio(bgColor, palette[i])
		if contrast < MinContrastRatio {
			palette[i] = boostContrastAgainstBg(palette[i], bgColor)
		}
	}

	// Generate color8 (bright black/gray for comments) with guaranteed contrast
	palette[8] = generateCommentColor(bgColor)

	// Generate bright versions (9-14) of colors 1-6 in OKLab space
	for i := 1; i <= 6; i++ {
		palette[i+8] = GenerateBrightVersion(palette[i])
	}

	// Generate color15 (bright white)
	palette[15] = GenerateBrightVersion(fgColor)

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

// boostContrastAgainstBg adjusts a color's OKLab lightness to meet minimum contrast
// against the background, preserving hue and chroma.
func boostContrastAgainstBg(hex string, bgColor string) string {
	lab := color.HexToOKLab(hex)
	lch := color.OKLabToOKLCH(lab)
	bgLab := color.HexToOKLab(bgColor)

	step := 0.03
	if bgLab.L < 0.5 {
		// Dark bg: push color lighter
		for lch.L < 0.90 {
			lch.L += step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= MinContrastRatio {
				return candidate
			}
		}
	} else {
		// Light bg: push color darker
		for lch.L > 0.10 {
			lch.L -= step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= MinContrastRatio {
				return candidate
			}
		}
	}

	return color.OKLCHToHex(lch)
}
