package color

import "math"

// OKLab represents a color in the OKLab perceptually uniform color space.
// L ranges from 0 (black) to 1 (white).
// A represents the green-red axis (roughly -0.4 to 0.4).
// B represents the blue-yellow axis (roughly -0.4 to 0.4).
type OKLab struct {
	L, A, B float64
}

// OKLCH represents a color in the OKLCH perceptually uniform color space (polar form of OKLab).
// L ranges from 0 (black) to 1 (white).
// C is chroma (colorfulness), ranging from 0 (gray) to ~0.37 (most vivid).
// H is hue in degrees, 0-360.
type OKLCH struct {
	L, C, H float64
}

// srgbToLinear converts an sRGB channel value (0-1) to linear light.
func srgbToLinear(c float64) float64 {
	if c <= 0.04045 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

// linearToSrgb converts a linear light value to sRGB channel (0-1).
func linearToSrgb(c float64) float64 {
	if c <= 0.0031308 {
		return 12.92 * c
	}
	return 1.055*math.Pow(c, 1.0/2.4) - 0.055
}

// RGBToOKLab converts an RGB color (0-255 per channel) to OKLab.
func RGBToOKLab(rgb RGB) OKLab {
	// sRGB to linear RGB
	r := srgbToLinear(rgb.R / 255.0)
	g := srgbToLinear(rgb.G / 255.0)
	b := srgbToLinear(rgb.B / 255.0)

	// Linear RGB to LMS (using the M1 matrix from Oklab spec)
	l := 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
	m := 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
	s := 0.0883024619*r + 0.2164557844*g + 0.6952417517*b

	// Cube root (perceptual non-linearity)
	l_ := math.Cbrt(l)
	m_ := math.Cbrt(m)
	s_ := math.Cbrt(s)

	// LMS to OKLab (using the M2 matrix from Oklab spec)
	return OKLab{
		L: 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
		A: 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
		B: 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_,
	}
}

// OKLabToRGB converts an OKLab color back to RGB (0-255 per channel).
// Out-of-gamut values are clamped to the sRGB gamut.
func OKLabToRGB(lab OKLab) RGB {
	// OKLab to LMS (inverse of M2)
	l_ := lab.L + 0.3963377774*lab.A + 0.2158037573*lab.B
	m_ := lab.L - 0.1055613458*lab.A - 0.0638541728*lab.B
	s_ := lab.L - 0.0894841775*lab.A - 1.2914855480*lab.B

	// Undo cube root
	l := l_ * l_ * l_
	m := m_ * m_ * m_
	s := s_ * s_ * s_

	// LMS to linear RGB (inverse of M1)
	r := +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
	g := -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
	b := -0.0041960863*l - 0.7034186147*m + 1.7076147010*s

	// Gamut clamp to [0, 1]
	r = math.Max(0, math.Min(1, r))
	g = math.Max(0, math.Min(1, g))
	b = math.Max(0, math.Min(1, b))

	// Linear to sRGB, then scale to 0-255
	return RGB{
		R: math.Round(linearToSrgb(r) * 255),
		G: math.Round(linearToSrgb(g) * 255),
		B: math.Round(linearToSrgb(b) * 255),
	}
}

// OKLabToOKLCH converts OKLab (Cartesian) to OKLCH (polar).
func OKLabToOKLCH(lab OKLab) OKLCH {
	c := math.Sqrt(lab.A*lab.A + lab.B*lab.B)
	h := math.Atan2(lab.B, lab.A) * 180.0 / math.Pi
	if h < 0 {
		h += 360
	}
	return OKLCH{L: lab.L, C: c, H: h}
}

// OKLCHToOKLab converts OKLCH (polar) to OKLab (Cartesian).
func OKLCHToOKLab(lch OKLCH) OKLab {
	rad := lch.H * math.Pi / 180.0
	return OKLab{
		L: lch.L,
		A: lch.C * math.Cos(rad),
		B: lch.C * math.Sin(rad),
	}
}

// RGBToOKLCH converts RGB to OKLCH.
func RGBToOKLCH(rgb RGB) OKLCH {
	return OKLabToOKLCH(RGBToOKLab(rgb))
}

// OKLCHToRGB converts OKLCH to RGB (clamped to sRGB gamut).
func OKLCHToRGB(lch OKLCH) RGB {
	return OKLabToRGB(OKLCHToOKLab(lch))
}

// HexToOKLab converts a hex color string to OKLab.
func HexToOKLab(hex string) OKLab {
	return RGBToOKLab(HexToRGB(hex))
}

// HexToOKLCH converts a hex color string to OKLCH.
func HexToOKLCH(hex string) OKLCH {
	return RGBToOKLCH(HexToRGB(hex))
}

// OKLabToHex converts OKLab to a hex color string.
func OKLabToHex(lab OKLab) string {
	rgb := OKLabToRGB(lab)
	return RGBToHex(rgb.R, rgb.G, rgb.B)
}

// OKLCHToHex converts OKLCH to a hex color string.
func OKLCHToHex(lch OKLCH) string {
	rgb := OKLCHToRGB(lch)
	return RGBToHex(rgb.R, rgb.G, rgb.B)
}

// OKLabDistance returns the Euclidean distance between two OKLab colors.
// In OKLab, this directly corresponds to perceived color difference (Delta-E).
func OKLabDistance(a, b OKLab) float64 {
	dl := a.L - b.L
	da := a.A - b.A
	db := a.B - b.B
	return math.Sqrt(dl*dl + da*da + db*db)
}

// OKLCHHueDistance calculates the circular hue distance between two OKLCH hues.
// Returns a value between 0 and 180 degrees.
func OKLCHHueDistance(h1, h2 float64) float64 {
	diff := math.Abs(h1 - h2)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}
