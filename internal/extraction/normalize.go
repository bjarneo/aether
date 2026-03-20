package extraction

import (
	"math"

	"aether/internal/color"
)

// NormalizeBrightness normalizes the brightness of ANSI colors to ensure readability
// against the background color. Handles very dark backgrounds, very light backgrounds,
// and outlier detection for normal backgrounds.
func NormalizeBrightness(palette [16]string) [16]string {
	bgHsl := color.HexToHSL(palette[0])
	bgLightness := bgHsl.L

	isVeryDarkBg := bgLightness < VeryDarkBackgroundThreshold
	isVeryLightBg := bgLightness > VeryLightBackgroundThreshold

	colorIndices := []int{1, 2, 3, 4, 5, 6, 7}

	type colorInfo struct {
		index      int
		lightness  float64
		hue        float64
		saturation float64
	}

	ansiColors := make([]colorInfo, len(colorIndices))
	for idx, i := range colorIndices {
		hsl := color.HexToHSL(palette[i])
		ansiColors[idx] = colorInfo{
			index:      i,
			lightness:  hsl.L,
			hue:        hsl.H,
			saturation: hsl.S,
		}
	}

	avgLightness := 0.0
	for _, c := range ansiColors {
		avgLightness += c.lightness
	}
	avgLightness /= float64(len(ansiColors))

	isBrightTheme := avgLightness > BrightThemeThreshold

	if isVeryDarkBg {
		for _, ci := range ansiColors {
			if ci.lightness < MinLightnessOnDarkBg {
				adjustedLightness := MinLightnessOnDarkBg + float64(ci.index)*3
				palette[ci.index] = AdjustColorLightness(palette[ci.index], adjustedLightness)
				if ci.index >= 1 && ci.index <= 6 {
					palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
				}
			}
		}
		return palette
	}

	if isVeryLightBg {
		for _, ci := range ansiColors {
			if ci.lightness > MaxLightnessOnLightBg {
				adjustedLightness := math.Max(AbsoluteMinLightness, MaxLightnessOnLightBg-float64(ci.index)*2)
				palette[ci.index] = AdjustColorLightness(palette[ci.index], adjustedLightness)
				if ci.index >= 1 && ci.index <= 6 {
					palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
				}
			}
		}
		return palette
	}

	// Normal background - apply outlier detection
	for _, ci := range ansiColors {
		if math.Abs(ci.lightness-avgLightness) <= OutlierLightnessThreshold {
			continue
		}

		isDarkOutlierInBrightTheme := isBrightTheme &&
			ci.lightness < avgLightness-OutlierLightnessThreshold
		isBrightOutlierInDarkTheme := !isBrightTheme &&
			ci.lightness > avgLightness+OutlierLightnessThreshold

		if isDarkOutlierInBrightTheme || isBrightOutlierInDarkTheme {
			var adjustedLightness float64
			if isDarkOutlierInBrightTheme {
				adjustedLightness = avgLightness - 10
			} else {
				adjustedLightness = avgLightness + 10
			}
			palette[ci.index] = AdjustColorLightness(palette[ci.index], adjustedLightness)
			if ci.index >= 1 && ci.index <= 6 {
				palette[ci.index+8] = GenerateBrightVersion(palette[ci.index])
			}
		}
	}

	return palette
}
