package extraction

const (
	ANSIPaletteSize   = 16
	CacheVersion      = 12 // Bumped: chromatic accents constrained to coverage-supported image hue clusters (no invented/minority hues)
	ImageScaleSize    = 400
	MinPixelsToSample = 1000
	MaxPixelsToSample = 50000

	// Dominant color extraction
	DominantColorsToExtract = 48

	// Chromatic weighting: pixels with OKLCH chroma above ChromaBoostThreshold get
	// duplicated in the median-cut pool so vivid accents aren't drowned out by large
	// muted backgrounds. The boost is graded by chroma rather than a flat factor: a
	// barely-chromatic pixel gets one extra copy (matching the old flat 2x), while the
	// most vivid pixels get up to ChromaBoostMaxExtra copies. The ramp is linear in
	// chroma over ChromaBoostRampChroma above the threshold. Grading (vs the old hard
	// 2x cliff at the threshold) lets a small saturated highlight earn proportionally
	// more representation, so the palette captures the image's actual "pop".
	ChromaBoostThreshold  = 0.04 // OKLCH chroma above which a pixel gets boosted
	ChromaBoostMaxExtra   = 3    // Max extra copies (=> up to 4x total) for the most vivid pixels
	ChromaBoostRampChroma = 0.16 // Chroma span above threshold over which the boost ramps to max

	// BackgroundDominanceWeight controls how much a candidate's coverage (share of
	// sampled pixels) nudges background/foreground selection, on top of its perceptual
	// lightness extremity. 0 reproduces the old "single most-extreme color" behavior;
	// higher values prefer a color that actually fills the image. 0.6 is a balanced
	// lean: lightness still leads (so a dark-mode bg stays dark), but a deep tone that
	// covers 40% of the wall beats a near-black speck covering 0.5%.
	BackgroundDominanceWeight = 0.6

	// Monochrome detection (OKLCH chroma-based)
	MonochromeChromaThreshold = 0.04 // OKLCH chroma below this = achromatic
	MonochromeImageThreshold  = 0.6  // 60% achromatic pixels = monochrome image
	// Low-hue-diversity detection: if circular variance over chromatic colors is
	// below this (= hues clustered tightly), the image is treated as monochromatic.
	// Catches solid-color and near-monoharmonic wallpapers that aren't gray.
	HueClusterMagnitudeThreshold = 0.85

	// MonoChromaticCoverageFloor: in the coverage-weighted classifier
	// (isMonochromeWeighted), an image whose colored pixels cover less than this
	// share of the frame is treated as monochrome regardless of how those few
	// colored pixels are distributed. This catches a near-gray image with a small
	// vivid speck (a logo, a distant neon sign): the chroma-boost duplicates those
	// specks enough to fool an unweighted count into seeing a colorful, multi-hue
	// image, but by true coverage the frame is monochrome and should get a cohesive
	// single-family palette rather than vivid accents pulled from a 1% region.
	//
	// Kept low (6%) so only genuinely color-starved images fall here: an image with
	// real, if minority, multi-hue content (a landscape's green hills under blue sky)
	// stays above the floor and is routed by the hue-cluster test, which sends it to
	// the chromatic path where its distinct hues are preserved.
	MonoChromaticCoverageFloor = 0.06

	// Monochrome fold arc: tinted-mono palettes map the six canonical ANSI hues
	// into an arc centered on the image's dominant hue (see foldHueIntoArc), so
	// every accent stays inside the wallpaper's color family instead of being a
	// rotated-but-still-rainbow set. arcDeg is the arc half-width in degrees: a
	// hue equal to the base lands on the base, one opposite the base lands at the
	// edge. Smaller arc = more unified/monochromatic; larger = more in-family
	// variety.
	//
	//   - AutoMonoArcDeg: the default auto-detected mono path. Wide enough that a
	//     mono image with a little real hue variety still fans its accents out
	//     across the family, but never far enough to leave it.
	//   - ExplicitMonoArcDeg: the user-selected `monochromatic` mode. Tighter, so
	//     the whole palette reads as one cohesive color family; the six slots stay
	//     distinct via their lightness spread.
	AutoMonoArcDeg     = 46.0
	ExplicitMonoArcDeg = 28.0

	// MonoChromaFactorFloor is the minimum scale applied to the canonical mono
	// ANSI chroma arrays (see monoChromaFactor). An image whose salient regions
	// are as saturated as a vivid terminal slot yields factor 1.0 (full vivid
	// accents); near-gray sources scale down toward this floor, which is kept
	// above 0 so the six hues stay faintly tinted and distinguishable rather than
	// collapsing to flat gray.
	MonoChromaFactorFloor = 0.4

	// MonoAccentMinLStep is the minimum OKLab-lightness gap between consecutive
	// accents on the monochrome lightness ramp. Because the hue fold packs the six
	// accents into one narrow family, lightness is the primary thing keeping them
	// apart; enforcing a floor on the step guarantees they stay distinguishable for
	// syntax highlighting even on a mid-toned background with little readable
	// headroom (where an evenly-divided ramp would otherwise collapse them).
	MonoAccentMinLStep = 0.072

	// Chromatic accent normalization (default chromatic path, normalizeChromaticAccents).
	// AccentChromaFloor/Ceil bound the per-slot chroma target derived from the image's
	// salient chroma, so accents pop enough to be usable but a vivid image isn't pushed
	// past a sane terminal saturation. NearAchromaticChroma is the chroma below which a
	// picked accent is treated as gray (its hue is quantization noise) and given its
	// slot's canonical ANSI hue. AccentMinDeltaE is the minimum OKLab distance enforced
	// between any two accents; collisions are separated by lightness only (never by
	// inventing a hue absent from the image).
	AccentChromaFloor    = 0.05
	AccentChromaCeil     = 0.16
	NearAchromaticChroma = 0.03
	AccentMinDeltaE      = 0.05
	// AccentSupportChroma: minimum OKLCH chroma for a dominant color to count as a
	// real hue anchor when folding a gray accent pick into the image's color family.
	AccentSupportChroma = 0.04
	// HueSupportTol: an accent whose hue is within this many degrees of a populated
	// image hue cluster is considered supported by the wallpaper and left as-is.
	HueSupportTol = 30.0
	// MinAccentHueSupport: minimum coverage share (of the whole frame) a 30-degree
	// hue band must carry to host accents. Bands below this are minority/stray hues;
	// accents are folded out of them into the nearest well-supported cluster so the
	// palette never promotes a color the wallpaper barely contains. Low enough to
	// keep small-but-real features (string lights, a neon sign) as their own family.
	MinAccentHueSupport = 0.025

	// MinMeaningfulTintChroma: minimum *average* chroma across all dominant
	// samples for `detectMonochromeTint` to consider the image actually
	// tinted. JPEG compression can leave a few samples with chroma
	// 0.003-0.008 in an otherwise-grayscale photo; without this floor the
	// detector calls a strongly-clustered noise band "a tint" and produces
	// a blue palette from a black-and-white image. Above this floor the
	// image is treated as a unified mono mood; below, pure grayscale.
	MinMeaningfulTintChroma = 0.008

	// OKLCH scoring thresholds
	MinChromaForAnsiMatch = 0.035 // Minimum OKLCH chroma for a valid ANSI color match
	LowChromaThreshold    = 0.05  // Low but visible chroma (mild penalty in scoring)
	IdealChromaMin        = 0.06  // Sweet spot for ANSI colors
	IdealChromaMax        = 0.20
	TooDarkLightness      = 0.25 // OKLab L below this is too dark for ANSI colors
	TooBrightLightness    = 0.87 // OKLab L above this is too bright

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
