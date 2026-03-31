package extraction

import (
	"math"

	"aether/internal/color"
)

// NormalizeBrightness normalizes the brightness of ANSI colors using OKLab perceptual
// lightness and WCAG contrast ratios to ensure readability against the background.
func NormalizeBrightness(palette [16]string) [16]string {
	bgLab := color.HexToOKLab(palette[0])
	bgL := bgLab.L

	isVeryDarkBg := bgL < VeryDarkBgLightness
	isVeryLightBg := bgL > VeryLightBgLightness

	colorIndices := []int{1, 2, 3, 4, 5, 6}

	type colorInfo struct {
		index int
		labL  float64 // OKLab perceptual lightness
	}

	ansiColors := make([]colorInfo, len(colorIndices))
	for idx, i := range colorIndices {
		lab := color.HexToOKLab(palette[i])
		ansiColors[idx] = colorInfo{
			index: i,
			labL:  lab.L,
		}
	}

	avgL := 0.0
	for _, c := range ansiColors {
		avgL += c.labL
	}
	avgL /= float64(len(ansiColors))

	isBrightTheme := avgL > BrightThemeThreshold

	if isVeryDarkBg {
		// On very dark backgrounds, ensure all ANSI colors are visible
		for _, ci := range ansiColors {
			contrast := color.ContrastRatio(palette[0], palette[ci.index])
			if contrast < MinContrastRatio {
				// Boost lightness until contrast is met
				palette[ci.index] = boostContrastAgainstBg(palette[ci.index], palette[0])
				palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
			}
		}
		return palette
	}

	if isVeryLightBg {
		// On very light backgrounds, ensure all ANSI colors are dark enough
		for _, ci := range ansiColors {
			contrast := color.ContrastRatio(palette[0], palette[ci.index])
			if contrast < MinContrastRatio {
				palette[ci.index] = boostContrastAgainstBg(palette[ci.index], palette[0])
				palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
			}
		}
		return palette
	}

	// Normal background - detect and fix perceptual outliers
	for _, ci := range ansiColors {
		deviation := math.Abs(ci.labL - avgL)
		if deviation <= OutlierLightnessThreshold {
			continue
		}

		isDarkOutlierInBrightTheme := isBrightTheme && ci.labL < avgL-OutlierLightnessThreshold
		isBrightOutlierInDarkTheme := !isBrightTheme && ci.labL > avgL+OutlierLightnessThreshold

		if isDarkOutlierInBrightTheme || isBrightOutlierInDarkTheme {
			var adjustedL float64
			if isDarkOutlierInBrightTheme {
				adjustedL = avgL - 0.08
			} else {
				adjustedL = avgL + 0.08
			}
			palette[ci.index] = AdjustColorLightness(palette[ci.index], adjustedL)
			palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
		}
	}

	// Final pass: verify all ANSI colors (1-6) meet minimum contrast
	for _, ci := range ansiColors {
		contrast := color.ContrastRatio(palette[0], palette[ci.index])
		if contrast < MinContrastRatio {
			palette[ci.index] = boostContrastAgainstBg(palette[ci.index], palette[0])
			palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
		}
	}

	return palette
}
