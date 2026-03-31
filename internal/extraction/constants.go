package extraction

const (
	ANSIPaletteSize   = 16
	CacheVersion      = 3 // Bumped: OKLab-based extraction
	ImageScaleSize    = 400
	MinPixelsToSample = 1000
	MaxPixelsToSample = 50000

	// Dominant color extraction
	DominantColorsToExtract = 48

	// Chromatic weighting: pixels with OKLCH chroma above this get boosted in sampling
	ChromaBoostThreshold = 0.04
	ChromaBoostFactor    = 2 // How many times to duplicate chromatic pixels

	// Monochrome detection (OKLCH chroma-based)
	MonochromeChromaThreshold = 0.04 // OKLCH chroma below this = achromatic
	MonochromeImageThreshold  = 0.7  // 70% achromatic pixels = monochrome image

	// Monochrome tint
	MonochromeTintStrength = 0.15

	// OKLCH scoring thresholds
	MinChromaForAnsiMatch   = 0.035 // Minimum OKLCH chroma for a valid ANSI color match
	LowChromaThreshold      = 0.05  // Low but visible chroma (mild penalty in scoring)
	IdealChromaMin          = 0.06  // Sweet spot for ANSI colors
	IdealChromaMax          = 0.20
	TooDarkLightness        = 0.25 // OKLab L below this is too dark for ANSI colors
	TooBrightLightness      = 0.87 // OKLab L above this is too bright
	SynthesisScoreThreshold = 150.0

	// Background/foreground and normalization
	VeryDarkBgLightness  = 0.25 // OKLab L: very dark background
	VeryLightBgLightness = 0.82 // OKLab L: very light background
	MinContrastRatio     = 4.5  // WCAG AA minimum for normal text
	MinCommentContrast   = 3.0  // Minimum for color8 (comments)
	MinFgBgContrast      = 7.0  // Target contrast for fg/bg pair

	// Bright version generation
	BrightColorLightnessBoost  = 0.12 // OKLab L boost for bright variants
	BrightColorSaturationBoost = 1.1  // Chroma multiplier for bright variants

	// Normalization
	OutlierLightnessThreshold = 0.15 // OKLab L deviation to be an outlier
	BrightThemeThreshold      = 0.55 // OKLab L: avg above this = bright theme
	DarkColorThreshold        = 0.50 // OKLab L: below this = dark

)

// OKLCHAnsiHues contains OKLCH hue targets for the 6 ANSI color slots.
// Computed from pure sRGB primaries through the OKLab transform:
// Red(#FF0000)=29.2, Green(#00FF00)=139.1, Yellow(#FFFF00)=111.3,
// Blue(#0000FF)=266.7, Magenta(#FF00FF)=326.4, Cyan(#00FFFF)=194.8
var OKLCHAnsiHues = [6]float64{29.2, 139.1, 111.3, 266.7, 326.4, 194.8}
