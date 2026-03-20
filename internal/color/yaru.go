package color

// HexToYaruTheme maps a hex color to a Yaru icon theme variant based on its hue.
func HexToYaruTheme(hex string) string {
	rgb := HexToRGB(hex)
	hsl := RGBToHSL(rgb.R, rgb.G, rgb.B)
	hue := hsl.H

	// Red: 345-15 deg
	if hue >= 345 || hue < 15 {
		return "Yaru-red"
	}
	// Warty Brown (orange-brown): 15-30 deg
	if hue >= 15 && hue < 30 {
		return "Yaru-wartybrown"
	}
	// Yellow: 30-60 deg
	if hue >= 30 && hue < 60 {
		return "Yaru-yellow"
	}
	// Olive (yellow-green): 60-90 deg
	if hue >= 60 && hue < 90 {
		return "Yaru-olive"
	}
	// Sage (green): 90-165 deg
	if hue >= 90 && hue < 165 {
		return "Yaru-sage"
	}
	// Prussian Green (dark teal): 165-195 deg
	if hue >= 165 && hue < 195 {
		return "Yaru-prussiangreen"
	}
	// Blue: 195-255 deg
	if hue >= 195 && hue < 255 {
		return "Yaru-blue"
	}
	// Purple: 255-285 deg
	if hue >= 255 && hue < 285 {
		return "Yaru-purple"
	}
	// Magenta (purple-pink): 285-345 deg
	return "Yaru-magenta"
}
