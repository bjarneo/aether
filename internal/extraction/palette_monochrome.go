package extraction

import (
	"math"

	"aether/internal/color"
)

// detectMonochromeTint detects the dominant tint hue from mostly-gray colors using circular mean.
func detectMonochromeTint(colors []string) (hue float64, hasTint bool) {
	var sinSum, cosSum float64
	count := 0

	for _, c := range colors {
		hsl := color.HexToHSL(c)
		if hsl.S > 3 {
			rad := hsl.H * math.Pi / 180
			sinSum += math.Sin(rad)
			cosSum += math.Cos(rad)
			count++
		}
	}

	if count == 0 {
		return 0, false
	}

	avgHue := math.Mod(math.Atan2(sinSum/float64(count), cosSum/float64(count))*180/math.Pi+360, 360)
	return avgHue, true
}

// applyTint applies tint influence to an ANSI hue based on the image's dominant tone.
func applyTint(ansiHue, tintHue float64, hasTint bool) float64 {
	if !hasTint {
		return ansiHue
	}
	hueDiff := math.Mod(tintHue-ansiHue+540, 360) - 180
	return math.Mod(ansiHue+hueDiff*MonochromeTintStrength+360, 360)
}

// GenerateMonochromePalette generates a monochrome ANSI palette with distinguishable
// hue-tinted colors. Uses proper ANSI hue targets at subdued saturation so colors
// remain functional for syntax highlighting while matching the monochrome mood.
func GenerateMonochromePalette(grayColors []string, lightMode bool) [16]string {
	sortedByLightness := SortColorsByLightness(grayColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]
	tintHue, hasTint := detectMonochromeTint(grayColors)

	var palette [16]string

	// Background and foreground from actual image extremes
	if lightMode {
		palette[0] = lightest.Color
		palette[7] = darkest.Color
	} else {
		palette[0] = darkest.Color
		palette[7] = lightest.Color
	}

	// ANSI colors 1-6: proper hues with subdued saturation, tinted toward image tone
	lightnessBase := 60.0
	if lightMode {
		lightnessBase = 45.0
	}
	for i := 0; i < len(ANSIHueArray); i++ {
		hue := applyTint(ANSIHueArray[i], tintHue, hasTint)
		lightness := lightnessBase + (float64(i)-2.5)*4
		palette[i+1] = color.HSLToHex(hue, MonochromeAnsiSaturation, lightness)
	}

	// Color 8: neutral gray for comments
	var color8Lightness float64
	if lightMode {
		color8Lightness = math.Max(0, lightest.Lightness-35)
	} else {
		color8Lightness = math.Min(100, darkest.Lightness+40)
	}
	palette[8] = color.HSLToHex(tintHue, MonochromeSaturation*MonochromeColor8SatFactor, color8Lightness)

	// Colors 9-14: brighter, slightly more saturated versions of 1-6
	for i := 0; i < len(ANSIHueArray); i++ {
		hue := applyTint(ANSIHueArray[i], tintHue, hasTint)
		baseLightness := lightnessBase + (float64(i)-2.5)*4
		adjustment := 6.0
		if lightMode {
			adjustment = -6.0
		}
		lightness := math.Max(0, math.Min(100, baseLightness+adjustment))
		palette[i+9] = color.HSLToHex(hue, MonochromeAnsiBrightSaturation, lightness)
	}

	// Color 15: near-white or near-black from image
	if lightMode {
		palette[15] = color.HSLToHex(tintHue, 5, math.Max(0, darkest.Lightness-5))
	} else {
		palette[15] = color.HSLToHex(tintHue, 5, math.Min(100, lightest.Lightness+5))
	}

	return palette
}

// GenerateMonochromaticPalette generates a monochromatic ANSI palette based on
// the dominant hue from the image.
func GenerateMonochromaticPalette(dominantColors []string, lightMode bool) [16]string {
	// Find the most frequent color with good saturation
	var baseHue float64
	found := false
	for _, c := range dominantColors {
		hsl := color.HexToHSL(c)
		if hsl.S > MonochromeSaturationThreshold {
			baseHue = hsl.H
			found = true
			break
		}
	}
	if !found {
		hsl := color.HexToHSL(dominantColors[0])
		baseHue = hsl.H
	}

	sortedByLightness := SortColorsByLightness(dominantColors)
	darkest := sortedByLightness[0]
	lightest := sortedByLightness[len(sortedByLightness)-1]

	var palette [16]string

	if lightMode {
		palette[0] = color.HSLToHex(baseHue, 8, math.Max(85, lightest.Lightness))
		palette[7] = color.HSLToHex(baseHue, 25, math.Min(30, darkest.Lightness+10))
	} else {
		palette[0] = color.HSLToHex(baseHue, 15, math.Min(15, darkest.Lightness))
		palette[7] = color.HSLToHex(baseHue, 10, math.Max(80, lightest.Lightness-10))
	}

	saturationLevels := [6]float64{40, 50, 45, 55, 42, 48}
	lightnessBase := 55.0
	if lightMode {
		lightnessBase = 45.0
	}

	for i := 0; i < 6; i++ {
		lightness := lightnessBase + (float64(i)-2.5)*5
		palette[i+1] = color.HSLToHex(baseHue, saturationLevels[i], lightness)
	}

	if lightMode {
		palette[8] = color.HSLToHex(baseHue, 20, 40)
	} else {
		palette[8] = color.HSLToHex(baseHue, 20, 65)
	}

	brightSaturationLevels := [6]float64{60, 70, 65, 75, 62, 68}
	for i := 0; i < 6; i++ {
		baseLightness := lightnessBase + (float64(i)-2.5)*5
		adjustment := 8.0
		if lightMode {
			adjustment = -8.0
		}
		lightness := math.Max(0, math.Min(100, baseLightness+adjustment))
		palette[i+9] = color.HSLToHex(baseHue, brightSaturationLevels[i], lightness)
	}

	if lightMode {
		palette[15] = color.HSLToHex(baseHue, 30, math.Min(25, darkest.Lightness+5))
	} else {
		palette[15] = color.HSLToHex(baseHue, 15, math.Max(85, lightest.Lightness))
	}

	return palette
}
