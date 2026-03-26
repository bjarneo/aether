package color

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
)

// clampL clamps lightness to [0, 100].
func clampL(l float64) float64 { return math.Max(0, math.Min(100, l)) }

// clampByte clamps a float64 to [0, 255] and converts to uint8.
func clampByte(v float64) uint8 {
	if v <= 0 {
		return 0
	}
	if v >= 255 {
		return 255
	}
	return uint8(math.Round(v))
}

var hexPattern = regexp.MustCompile(`(?i)^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$`)

// HexToRGB parses a "#rrggbb" hex string into an RGB struct.
// Returns {0,0,0} if the hex string is invalid.
func HexToRGB(hex string) RGB {
	matches := hexPattern.FindStringSubmatch(hex)
	if matches == nil {
		return RGB{R: 0, G: 0, B: 0}
	}
	r, _ := strconv.ParseInt(matches[1], 16, 64)
	g, _ := strconv.ParseInt(matches[2], 16, 64)
	b, _ := strconv.ParseInt(matches[3], 16, 64)
	return RGB{R: float64(r), G: float64(g), B: float64(b)}
}

// RGBToHSL converts RGB values (0-255) to HSL (H: 0-360, S: 0-100, L: 0-100).
func RGBToHSL(r, g, b float64) HSL {
	r /= 255
	g /= 255
	b /= 255

	max := math.Max(r, math.Max(g, b))
	min := math.Min(r, math.Min(g, b))
	var h, s float64
	l := (max + min) / 2

	if max == min {
		h = 0
		s = 0
	} else {
		d := max - min
		if l > 0.5 {
			s = d / (2 - max - min)
		} else {
			s = d / (max + min)
		}

		switch max {
		case r:
			h = (g - b) / d
			if g < b {
				h += 6
			}
			h /= 6
		case g:
			h = ((b-r)/d + 2) / 6
		case b:
			h = ((r-g)/d + 4) / 6
		}
	}

	return HSL{H: h * 360, S: s * 100, L: l * 100}
}

// hue2rgb is the helper function for HSL to RGB conversion.
func hue2rgb(p, q, t float64) float64 {
	if t < 0 {
		t += 1
	}
	if t > 1 {
		t -= 1
	}
	if t < 1.0/6.0 {
		return p + (q-p)*6*t
	}
	if t < 1.0/2.0 {
		return q
	}
	if t < 2.0/3.0 {
		return p + (q-p)*(2.0/3.0-t)*6
	}
	return p
}

// HSLToRGB converts HSL values (H: 0-360, S: 0-100, L: 0-100) to RGB (0-255).
func HSLToRGB(h, s, l float64) RGB {
	h /= 360
	s /= 100
	l /= 100

	var r, g, b float64

	if s == 0 {
		r = l
		g = l
		b = l
	} else {
		var q float64
		if l < 0.5 {
			q = l * (1 + s)
		} else {
			q = l + s - l*s
		}
		p := 2*l - q

		r = hue2rgb(p, q, h+1.0/3.0)
		g = hue2rgb(p, q, h)
		b = hue2rgb(p, q, h-1.0/3.0)
	}

	return RGB{R: r * 255, G: g * 255, B: b * 255}
}

// RGBToHex converts RGB values (0-255) to a hex color string "#rrggbb".
func RGBToHex(r, g, b float64) string {
	return fmt.Sprintf("#%02x%02x%02x", clampByte(r), clampByte(g), clampByte(b))
}

// HSLToHex converts HSL values to a hex color string.
func HSLToHex(h, s, l float64) string {
	rgb := HSLToRGB(h, s, l)
	return RGBToHex(rgb.R, rgb.G, rgb.B)
}

// HexToHSL converts a hex color string to HSL.
func HexToHSL(hex string) HSL {
	rgb := HexToRGB(hex)
	return RGBToHSL(rgb.R, rgb.G, rgb.B)
}

// HexToRGBString converts a hex color to an "r,g,b" decimal string.
func HexToRGBString(hex string) string {
	rgb := HexToRGB(hex)
	return fmt.Sprintf("%d,%d,%d", clampByte(rgb.R), clampByte(rgb.G), clampByte(rgb.B))
}

// HexToRGBSpaceString converts a hex color to an "r g b" space-separated decimal string.
// Used by KDL-based configs like Zellij.
func HexToRGBSpaceString(hex string) string {
	rgb := HexToRGB(hex)
	return fmt.Sprintf("%d %d %d", clampByte(rgb.R), clampByte(rgb.G), clampByte(rgb.B))
}

// HexToRGBA converts a hex color to an "rgba(r, g, b, a)" string.
func HexToRGBA(hex string, alpha float64) string {
	rgb := HexToRGB(hex)
	return fmt.Sprintf("rgba(%d, %d, %d, %g)", clampByte(rgb.R), clampByte(rgb.G), clampByte(rgb.B), alpha)
}
