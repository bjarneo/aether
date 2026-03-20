package color

import "math"

// getRelativeLuminance calculates the WCAG 2.0 relative luminance of a hex color.
func getRelativeLuminance(hex string) float64 {
	rgb := HexToRGB(hex)

	// Convert to sRGB
	rsRGB := rgb.R / 255
	gsRGB := rgb.G / 255
	bsRGB := rgb.B / 255

	// Apply gamma correction (sRGB to linear)
	var r, g, b float64
	if rsRGB <= 0.04045 {
		r = rsRGB / 12.92
	} else {
		r = math.Pow((rsRGB+0.055)/1.055, 2.4)
	}
	if gsRGB <= 0.04045 {
		g = gsRGB / 12.92
	} else {
		g = math.Pow((gsRGB+0.055)/1.055, 2.4)
	}
	if bsRGB <= 0.04045 {
		b = bsRGB / 12.92
	} else {
		b = math.Pow((bsRGB+0.055)/1.055, 2.4)
	}

	return 0.2126*r + 0.7152*g + 0.0722*b
}

// ContrastRatio calculates the WCAG 2.0 contrast ratio between two hex colors.
// Returns a value between 1 and 21.
func ContrastRatio(hex1, hex2 string) float64 {
	l1 := getRelativeLuminance(hex1)
	l2 := getRelativeLuminance(hex2)

	lighter := math.Max(l1, l2)
	darker := math.Min(l1, l2)

	return (lighter + 0.05) / (darker + 0.05)
}
