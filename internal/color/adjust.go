package color

import "math"

// AdjustColor applies the 12-step color adjustment pipeline to a hex color.
// The pipeline order is critical and must match the JavaScript implementation exactly.
func AdjustColor(hex string, adj Adjustments) string {
	rgb := HexToRGB(hex)
	hsl := RGBToHSL(rgb.R, rgb.G, rgb.B)

	hsl = applyHueShift(hsl, adj.HueShift)
	hsl = applyTemperature(hsl, adj.Temperature)
	hsl = applyTint(hsl, adj.Tint)
	hsl = applyVibrance(hsl, adj.Vibrance)
	hsl = applySaturation(hsl, adj.Saturation)
	hsl = applyBrightness(hsl, adj.Brightness)
	hsl = applyShadows(hsl, adj.Shadows)
	hsl = applyHighlights(hsl, adj.Highlights)
	hsl = applyBlackPoint(hsl, adj.BlackPoint)
	hsl = applyWhitePoint(hsl, adj.WhitePoint)
	hsl = applyContrast(hsl, adj.Contrast)

	if adj.Gamma != 1.0 {
		return applyGamma(hsl, adj.Gamma)
	}
	return HSLToHex(hsl.H, hsl.S, hsl.L)
}

// --- Pipeline steps (1-12) ---

func applyHueShift(hsl HSL, amount float64) HSL {
	hsl.H = math.Mod(hsl.H+amount+360, 360)
	return hsl
}

func applyHueTarget(hsl HSL, target, amount float64) HSL {
	t := math.Abs(amount) / 100
	hueDiff := math.Mod(target-hsl.H+540, 360) - 180
	hsl.H = math.Mod(hsl.H+hueDiff*t*0.3+360, 360)
	return hsl
}

func applyTemperature(hsl HSL, temp float64) HSL {
	if temp == 0 {
		return hsl
	}
	target := 210.0 // cool
	if temp > 0 {
		target = 30.0 // warm
	}
	return applyHueTarget(hsl, target, temp)
}

func applyTint(hsl HSL, tint float64) HSL {
	if tint == 0 {
		return hsl
	}
	target := 120.0 // green (negative)
	if tint > 0 {
		target = 300.0 // magenta
	}
	return applyHueTarget(hsl, target, tint)
}

func applyVibrance(hsl HSL, vibrance float64) HSL {
	hsl.S = clampL(hsl.S + vibrance)
	return hsl
}

func applySaturation(hsl HSL, saturation float64) HSL {
	if saturation != 0 {
		hsl.S = clampL(hsl.S * (100 + saturation) / 100)
	}
	return hsl
}

func applyBrightness(hsl HSL, brightness float64) HSL {
	hsl.L = clampL(hsl.L + brightness)
	return hsl
}

func applyShadows(hsl HSL, shadows float64) HSL {
	if shadows != 0 && hsl.L < 30 {
		strength := 1 - hsl.L/30
		hsl.L = clampL(hsl.L + shadows*strength)
	}
	return hsl
}

func applyHighlights(hsl HSL, highlights float64) HSL {
	if highlights != 0 && hsl.L > 70 {
		strength := (hsl.L - 70) / 30
		hsl.L = clampL(hsl.L + highlights*strength)
	}
	return hsl
}

func applyBlackPoint(hsl HSL, bp float64) HSL {
	if bp == 0 {
		return hsl
	}
	minL := math.Max(0, bp)
	adjustedMinL := math.Max(0, -bp)
	hsl.L = adjustedMinL + (hsl.L*(100-adjustedMinL-minL))/100 + minL
	hsl.L = clampL(hsl.L)
	return hsl
}

func applyWhitePoint(hsl HSL, wp float64) HSL {
	if wp == 0 {
		return hsl
	}
	if wp > 0 {
		hsl.L = math.Min(100-wp, hsl.L)
	} else {
		hsl.L = clampL(hsl.L - wp*(1-hsl.L/100))
	}
	hsl.L = clampL(hsl.L)
	return hsl
}

func applyContrast(hsl HSL, contrast float64) HSL {
	factor := contrast / 100
	deviation := hsl.L - 50
	hsl.L = clampL(50 + deviation*(1+factor))
	return hsl
}

func applyGamma(hsl HSL, gamma float64) string {
	rgb := HSLToRGB(hsl.H, hsl.S, hsl.L)
	invGamma := 1 / gamma
	rgb.R = math.Max(0, math.Min(255, math.Pow(rgb.R/255, invGamma)*255))
	rgb.G = math.Max(0, math.Min(255, math.Pow(rgb.G/255, invGamma)*255))
	rgb.B = math.Max(0, math.Min(255, math.Pow(rgb.B/255, invGamma)*255))
	return RGBToHex(rgb.R, rgb.G, rgb.B)
}
