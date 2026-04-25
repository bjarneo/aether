package extraction

const (
	ANSIPaletteSize   = 16
	CacheVersion      = 6 // Bumped: auto-extract pipeline fixes (outlier loop, scoring, bg synth)
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
	MonochromeImageThreshold  = 0.6  // 60% achromatic pixels = monochrome image
	// Low-hue-diversity detection: if circular variance over chromatic colors is
	// below this (= hues clustered tightly), the image is treated as monochromatic.
	// Catches solid-color and near-monoharmonic wallpapers that aren't gray.
	HueClusterMagnitudeThreshold = 0.85

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

	// Contrast thresholds
	MinContrastRatio     = 4.5 // WCAG AA minimum for normal text
	MinHighContrastRatio = 7.0 // WCAG AAA target for the high-contrast mode
	MinCommentContrast   = 3.0 // Minimum for color8 (comments)
	MinFgBgContrast      = 7.0 // Target contrast for fg/bg pair

	// Bright version generation
	BrightColorLightnessBoost  = 0.12 // OKLab L boost for bright variants
	BrightColorSaturationBoost = 1.1  // Chroma multiplier for bright variants

	DarkColorThreshold = 0.50 // OKLab L: below this = dark
)

// OKLCHAnsiHues contains OKLCH hue targets for the 6 ANSI color slots.
// Computed from pure sRGB primaries through the OKLab transform:
// Red(#FF0000)=29.2, Green(#00FF00)=139.1, Yellow(#FFFF00)=111.3,
// Blue(#0000FF)=266.7, Magenta(#FF00FF)=326.4, Cyan(#00FFFF)=194.8
var OKLCHAnsiHues = [6]float64{29.2, 139.1, 111.3, 266.7, 326.4, 194.8}
