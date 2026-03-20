package color

import "math"

// GenerateGradient generates a smooth 16-step linear RGB gradient between two hex colors.
func GenerateGradient(startColor, endColor string) [16]string {
	s := HexToRGB(startColor)
	e := HexToRGB(endColor)

	var colors [16]string
	for i := 0; i < 16; i++ {
		t := float64(i) / 15.0
		r := math.Round(s.R + (e.R-s.R)*t)
		g := math.Round(s.G + (e.G-s.G)*t)
		b := math.Round(s.B + (e.B-s.B)*t)
		colors[i] = RGBToHex(r, g, b)
	}
	return colors
}

// GeneratePaletteFromColor generates a complete 16-color ANSI palette from a single base color.
// Places the base color in the correct ANSI slot based on its hue, then generates
// matching colors for other slots while maintaining the same saturation and lightness.
func GeneratePaletteFromColor(baseColor string) [16]string {
	hsl := HexToHSL(baseColor)
	baseSat := hsl.S
	baseLight := hsl.L
	baseHue := hsl.H

	// Hue ranges mapping to ANSI slot (1-6)
	type hueRange struct {
		min, max float64
		slot     int
	}
	hueRanges := []hueRange{
		{345, 360, 1},
		{0, 45, 1},    // Red
		{45, 75, 3},   // Yellow
		{75, 165, 2},  // Green
		{165, 195, 6}, // Cyan
		{195, 285, 4}, // Blue
		{285, 345, 5}, // Magenta
	}

	baseSlot := 1 // default
	for _, r := range hueRanges {
		if baseHue >= r.min && baseHue < r.max {
			baseSlot = r.slot
			break
		}
	}

	// Standard ANSI color hues: Red, Green, Yellow, Blue, Magenta, Cyan
	ansiHues := [6]float64{0, 120, 60, 240, 300, 180}

	// Generate standard colors (1-6)
	var colors1to6 [6]string
	for i, hue := range ansiHues {
		if i+1 == baseSlot {
			colors1to6[i] = baseColor
		} else {
			colors1to6[i] = HSLToHex(hue, baseSat, baseLight)
		}
	}

	// Generate bright versions (9-14)
	brightLight := math.Min(100, baseLight+10)
	brightSat := math.Min(100, baseSat*1.1)
	var colors9to14 [6]string
	for i, hue := range ansiHues {
		if i+1 == baseSlot {
			colors9to14[i] = HSLToHex(baseHue, brightSat, brightLight)
		} else {
			colors9to14[i] = HSLToHex(hue, brightSat, brightLight)
		}
	}

	var palette [16]string
	palette[0] = HSLToHex(baseHue, baseSat*0.4, math.Max(3, baseLight*0.15))
	for i := 0; i < 6; i++ {
		palette[i+1] = colors1to6[i]
	}
	palette[7] = HSLToHex(baseHue, baseSat*0.15, 92)
	palette[8] = HSLToHex(baseHue, baseSat*0.35, math.Min(40, baseLight))
	for i := 0; i < 6; i++ {
		palette[i+9] = colors9to14[i]
	}
	palette[15] = HSLToHex(baseHue, baseSat*0.1, 98)

	return palette
}
