package color

import "math"

// DarkenRGB darkens a hex color by multiplying each RGB channel by percent/100.
// 0 = black, 100 = unchanged.
func DarkenRGB(hex string, percent float64) string {
	rgb := HexToRGB(hex)
	return RGBToHex(
		math.Round(rgb.R*percent/100),
		math.Round(rgb.G*percent/100),
		math.Round(rgb.B*percent/100),
	)
}

// LightenRGB lightens a hex color by blending each RGB channel toward white.
// 0 = unchanged, 100 = white.
func LightenRGB(hex string, percent float64) string {
	rgb := HexToRGB(hex)
	return RGBToHex(
		math.Round(rgb.R+(255-rgb.R)*percent/100),
		math.Round(rgb.G+(255-rgb.G)*percent/100),
		math.Round(rgb.B+(255-rgb.B)*percent/100),
	)
}
