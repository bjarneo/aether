package color

// RGB represents a color in the RGB color space.
// R, G, B values range from 0-255.
type RGB struct {
	R, G, B float64
}

// HSL represents a color in the HSL color space.
// H ranges from 0-360, S and L range from 0-100.
type HSL struct {
	H, S, L float64
}

// HexColor is a hex string like "#ff00ff".
type HexColor = string

// Adjustments holds all 12 adjustment parameters for the color adjustment pipeline.
type Adjustments struct {
	Vibrance    float64 `json:"vibrance"`
	Saturation  float64 `json:"saturation"`
	Contrast    float64 `json:"contrast"`
	Brightness  float64 `json:"brightness"`
	Shadows     float64 `json:"shadows"`
	Highlights  float64 `json:"highlights"`
	HueShift    float64 `json:"hueShift"`
	Temperature float64 `json:"temperature"`
	Tint        float64 `json:"tint"`
	Gamma       float64 `json:"gamma"`
	BlackPoint  float64 `json:"blackPoint"`
	WhitePoint  float64 `json:"whitePoint"`
}

// DefaultAdjustments returns an Adjustments with all zero values except Gamma=1.0.
func DefaultAdjustments() Adjustments {
	return Adjustments{Gamma: 1.0}
}
