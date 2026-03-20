package extraction

const (
	ANSIPaletteSize                = 16
	DominantColorsToExtract        = 48
	CacheVersion                   = 2
	MonochromeSaturationThreshold  = 15.0
	MonochromeImageThreshold       = 0.7
	LowDiversityThreshold          = 0.6
	SimilarHueRange                = 30.0
	SimilarLightnessRange          = 20.0
	MinChromaticSaturation         = 15.0
	IdealSaturationMin             = 30.0
	IdealSaturationMax             = 100.0
	IdealLightnessMin              = 30.0
	IdealLightnessMax              = 80.0
	TooDarkThreshold               = 20.0
	TooBrightThreshold             = 85.0
	VeryDarkBackgroundThreshold    = 20.0
	VeryLightBackgroundThreshold   = 80.0
	MinLightnessOnDarkBg           = 55.0
	MaxLightnessOnLightBg          = 45.0
	AbsoluteMinLightness           = 25.0
	OutlierLightnessThreshold      = 25.0
	BrightThemeThreshold           = 50.0
	DarkColorThreshold             = 50.0
	SubtlePaletteSaturation        = 28.0
	MonochromeSaturation           = 5.0
	MonochromeAnsiSaturation       = 30.0
	MonochromeAnsiBrightSaturation = 40.0
	MonochromeTintStrength         = 0.15
	MonochromeColor8SatFactor      = 0.5
	BrightColorLightnessBoost      = 18.0
	BrightColorSaturationBoost     = 1.1
	SynthesisScoreThreshold        = 180.0
	AnsiMinSaturationForMatch      = 12.0
	ImageScaleSize                 = 300
	MinPixelsToSample              = 1000
	MaxPixelsToSample              = 40000
)

// ANSIHueArray contains the ordered ANSI hue targets for colors 1-6:
// Red=0, Green=120, Yellow=60, Blue=240, Magenta=300, Cyan=180.
var ANSIHueArray = [6]float64{0, 120, 60, 240, 300, 180}
