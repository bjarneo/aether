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

	// Legacy HSL thresholds (used where HSL is still needed)
	MonochromeSaturationThreshold  = 15.0
	MonochromeSaturation           = 5.0
	MonochromeAnsiSaturation       = 30.0
	MonochromeAnsiBrightSaturation = 40.0
	MonochromeTintStrength         = 0.15
	MonochromeColor8SatFactor      = 0.5

	// OKLCH scoring thresholds
	MinChromaForAnsiMatch   = 0.035 // Minimum OKLCH chroma for a valid ANSI color match
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

	// Diversity
	LowDiversityThreshold   = 0.6
	SimilarHueRange         = 30.0
	SimilarLightnessRange   = 20.0
	MinChromaticSaturation  = 15.0
	SubtlePaletteSaturation = 28.0

	// Legacy HSL thresholds for palette_modes.go (still uses HSL pipeline)
	IdealSaturationMin = 30.0
	IdealSaturationMax = 100.0
	IdealLightnessMin  = 30.0
	IdealLightnessMax  = 80.0
)

// OKLCHAnsiHues contains OKLCH hue targets for the 6 ANSI color slots.
// These are the perceptually correct hues for each ANSI role, computed from
// reference sRGB primaries through the OKLab transform.
// Order: Red, Green, Yellow, Blue, Magenta, Cyan
var OKLCHAnsiHues = [6]float64{29.2, 142.5, 109.8, 264.1, 328.4, 194.8}

// ANSIHueArray contains the legacy HSL hue targets for modes that still use HSL.
// Red=0, Green=120, Yellow=60, Blue=240, Magenta=300, Cyan=180.
var ANSIHueArray = [6]float64{0, 120, 60, 240, 300, 180}
