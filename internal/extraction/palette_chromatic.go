package extraction

import (
	"math"

	"aether/internal/color"
)

// GenerateChromaticPalette generates a vibrant chromatic palette from diverse colors.
// Uses optimal global assignment and synthesizes missing hues.
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

	fgColor, fgIndex := FindForegroundColor(dominantColors, lightMode, usedIndices)
	usedIndices[fgIndex] = true

	var palette [16]string
	palette[0] = bgColor
	palette[7] = fgColor

	// Use global optimal assignment for ANSI colors 1-6
	assignments := FindOptimalAnsiAssignment(dominantColors, usedIndices)

	// Apply assignments, collecting matched colors for synthesis reference
	var matchedColors []string
	for i := 0; i < 6; i++ {
		assignment := assignments[i]
		if assignment != nil && assignment.Score < SynthesisScoreThreshold {
			hsl := color.HexToHSL(dominantColors[assignment.PoolIndex])
			if hsl.S >= AnsiMinSaturationForMatch {
				palette[i+1] = dominantColors[assignment.PoolIndex]
				matchedColors = append(matchedColors, palette[i+1])
				usedIndices[assignment.PoolIndex] = true
				continue
			}
		}
		palette[i+1] = "" // Mark for synthesis
	}

	// Synthesize any missing ANSI colors to match the palette's mood
	for i := 0; i < 6; i++ {
		if palette[i+1] == "" {
			palette[i+1] = SynthesizeAnsiColor(ANSIHueArray[i], matchedColors)
			matchedColors = append(matchedColors, palette[i+1])
		}
	}

	// Generate color8 (bright black/gray)
	bgHsl := color.HexToHSL(bgColor)
	var color8Lightness float64
	if IsDarkColor(bgColor) {
		color8Lightness = math.Min(100, bgHsl.L+45)
	} else {
		color8Lightness = math.Max(0, bgHsl.L-40)
	}
	palette[8] = color.HSLToHex(bgHsl.H, bgHsl.S*0.5, color8Lightness)

	// Generate bright versions (9-14) of colors 1-6
	for i := 1; i <= 6; i++ {
		palette[i+8] = GenerateBrightVersion(palette[i])
	}

	// Generate color15 (bright white)
	palette[15] = GenerateBrightVersion(fgColor)

	return palette
}
