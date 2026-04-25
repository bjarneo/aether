package extraction

import (
	"aether/internal/color"
)

// Mood-based palette generators. Each preserves the image's per-slot ANSI hue assignment
// (so slot 1 stays "red-ish", slot 4 stays "blue-ish") but pulls hues toward a mood anchor
// and clamps chroma/lightness to mood-appropriate bands. Background and foreground are
// mood-locked regardless of image content — they carry the mood identity.
//
// Mood signatures (dark-mode targets):
//                    bg L/C/H        ANSI L     C-band      tint    character
// Fire (firelight)   0.09/0.045/28   0.62      0.07-0.12   0.28    warm but dim, not vivid
// Ocean (deep)       0.10/0.050/240  0.60      0.09-0.14   0.28    deep, cool, immersive
// Forest (woodland)  0.13/0.040/145  0.66      0.06-0.10   0.25    organic, muted, balanced
// Earthtone (clay)   0.18/0.040/40   0.58      0.05-0.09   0.40    rustic, dim, low chroma
// Neon (cyberpunk)   0.05/0.030/280  0.72      0.20-0.26   0.00    max chroma, high luminance
// Sunset (golden)    0.12/0.060/350  0.70      0.12-0.18   0.32    rich, warm, saturated
// Vaporwave (synth)  0.15/0.060/315  0.74      0.10-0.16   0.28    dreamy, glowing magenta
// Midnight (peace)   0.07/0.035/250  0.62      0.07-0.12   0.20    deep indigo, subdued
// Aurora (polar)     0.08/0.045/240  0.70      0.12-0.18   0.42    shimmery green-cyan glow

type moodSpec struct {
	bgDark, bgLight                       color.OKLCH
	fgDark, fgLight                       color.OKLCH
	ansiHueAnchor                         float64
	ansiTintStrength                      float64
	ansiChromaMin, ansiChromaMax          float64
	ansiLightnessDark, ansiLightnessLight float64
	stagger                               [6]float64
}

// moodPalette builds a 16-color palette from a moodSpec. ANSI hues are pulled toward the
// mood anchor by tintStrength (0=preserve image hue, 1=replace with anchor); chroma is
// clamped into the mood's band; lightness sits at the mood's target plus the per-slot stagger.
func moodPalette(dominantColors []string, lightMode bool, spec moodSpec) [16]string {
	bgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return spec.bgLight },
		dark:  func(lch color.OKLCH) color.OKLCH { return spec.bgDark },
	}
	fgRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH { return spec.fgLight },
		dark:  func(lch color.OKLCH) color.OKLCH { return spec.fgDark },
	}
	ansiRule := &oklchRule{
		light: func(lch color.OKLCH) color.OKLCH {
			h := pullHueToward(lch.H, spec.ansiHueAnchor, spec.ansiTintStrength)
			return color.OKLCH{L: spec.ansiLightnessLight, C: clampF(lch.C, spec.ansiChromaMin, spec.ansiChromaMax), H: h}
		},
		dark: func(lch color.OKLCH) color.OKLCH {
			h := pullHueToward(lch.H, spec.ansiHueAnchor, spec.ansiTintStrength)
			return color.OKLCH{L: spec.ansiLightnessDark, C: clampF(lch.C, spec.ansiChromaMin, spec.ansiChromaMax), H: h}
		},
	}
	return transformChromaticPalette(dominantColors, lightMode, bgRule, fgRule, ansiRule, spec.stagger)
}

// GenerateFirePalette: bonfire warmth — deep dim ember bg, cream fg, warm-shifted dim ANSI.
// Lightness sits below other warm moods so the palette feels like firelight, not daylight.
func GenerateFirePalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.09, C: 0.045, H: 28},
		bgLight:            color.OKLCH{L: 0.95, C: 0.030, H: 45},
		fgDark:             color.OKLCH{L: 0.90, C: 0.040, H: 55},
		fgLight:            color.OKLCH{L: 0.22, C: 0.060, H: 20},
		ansiHueAnchor:      30,
		ansiTintStrength:   0.28,
		ansiChromaMin:      0.07,
		ansiChromaMax:      0.12,
		ansiLightnessDark:  0.62,
		ansiLightnessLight: 0.46,
		stagger:            [6]float64{-0.05, +0.01, +0.07, -0.04, -0.02, +0.03},
	})
}

// GenerateOceanPalette: deep-water immersion — blue-violet bg, cool sky fg, cool-shifted ANSI.
// Lower lightness target than the surface-light moods (forest/sunset) for a "sunken" feel.
func GenerateOceanPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.10, C: 0.050, H: 240},
		bgLight:            color.OKLCH{L: 0.96, C: 0.030, H: 215},
		fgDark:             color.OKLCH{L: 0.90, C: 0.035, H: 205},
		fgLight:            color.OKLCH{L: 0.20, C: 0.055, H: 230},
		ansiHueAnchor:      220,
		ansiTintStrength:   0.28,
		ansiChromaMin:      0.09,
		ansiChromaMax:      0.14,
		ansiLightnessDark:  0.60,
		ansiLightnessLight: 0.44,
		stagger:            [6]float64{-0.05, +0.02, +0.06, -0.03, -0.01, +0.03},
	})
}

// GenerateForestPalette: balanced woodland — visible green-black bg, sage fg, lightly-tinted ANSI.
// Lower chroma than fire/sunset because real forests read as muted, not vivid.
func GenerateForestPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.13, C: 0.040, H: 145},
		bgLight:            color.OKLCH{L: 0.95, C: 0.025, H: 130},
		fgDark:             color.OKLCH{L: 0.88, C: 0.035, H: 125},
		fgLight:            color.OKLCH{L: 0.24, C: 0.050, H: 140},
		ansiHueAnchor:      145,
		ansiTintStrength:   0.25,
		ansiChromaMin:      0.06,
		ansiChromaMax:      0.10,
		ansiLightnessDark:  0.66,
		ansiLightnessLight: 0.48,
		stagger:            [6]float64{-0.05, +0.02, +0.07, -0.03, -0.01, +0.04},
	})
}

// GenerateEarthtonePalette: rustic clay — visible warm brown bg, beige fg, strongly muted ANSI.
// Strongest tint among the warm moods so all slots converge into the earth band.
// Wide lightness stagger compensates for the low chroma so slots stay distinguishable.
func GenerateEarthtonePalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.18, C: 0.040, H: 40},
		bgLight:            color.OKLCH{L: 0.93, C: 0.025, H: 60},
		fgDark:             color.OKLCH{L: 0.84, C: 0.050, H: 50},
		fgLight:            color.OKLCH{L: 0.26, C: 0.055, H: 35},
		ansiHueAnchor:      45,
		ansiTintStrength:   0.40,
		ansiChromaMin:      0.05,
		ansiChromaMax:      0.09,
		ansiLightnessDark:  0.58,
		ansiLightnessLight: 0.44,
		stagger:            [6]float64{-0.10, -0.04, +0.04, +0.10, -0.07, +0.07},
	})
}

// GenerateNeonPalette: cyberpunk neon — near-black purple bg, electric teal fg, max-chroma ANSI.
// Tint is zero so image hues survive at maximum saturation; the mood is defined by chroma + bg.
// Lightness target is high (0.72) so colors glow against the very dark background.
func GenerateNeonPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.05, C: 0.030, H: 280},
		bgLight:            color.OKLCH{L: 0.97, C: 0.015, H: 280},
		fgDark:             color.OKLCH{L: 0.92, C: 0.045, H: 175},
		fgLight:            color.OKLCH{L: 0.18, C: 0.060, H: 290},
		ansiHueAnchor:      0,
		ansiTintStrength:   0,
		ansiChromaMin:      0.20,
		ansiChromaMax:      0.26,
		ansiLightnessDark:  0.72,
		ansiLightnessLight: 0.50,
		stagger:            [6]float64{-0.03, +0.01, +0.04, -0.02, -0.01, +0.02},
	})
}

// GenerateSunsetPalette: golden hour — deep magenta-dusk bg, peach fg, rich saturated ANSI.
// Higher chroma than fire (which is dim); higher lightness target so colors glow.
func GenerateSunsetPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.12, C: 0.060, H: 350},
		bgLight:            color.OKLCH{L: 0.96, C: 0.030, H: 30},
		fgDark:             color.OKLCH{L: 0.90, C: 0.050, H: 30},
		fgLight:            color.OKLCH{L: 0.24, C: 0.060, H: 350},
		ansiHueAnchor:      20,
		ansiTintStrength:   0.32,
		ansiChromaMin:      0.12,
		ansiChromaMax:      0.18,
		ansiLightnessDark:  0.70,
		ansiLightnessLight: 0.50,
		stagger:            [6]float64{-0.05, +0.02, +0.07, -0.04, -0.02, +0.04},
	})
}

// GenerateVaporwavePalette: synth dream — visible magenta-pink bg, electric cyan fg.
// Highest lightness target of the moods (0.74) so the palette glows like backlit chrome.
// The bg/fg deliberately split across the wheel (pink vs cyan) — iconic vaporwave two-tone.
func GenerateVaporwavePalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.15, C: 0.060, H: 315},
		bgLight:            color.OKLCH{L: 0.96, C: 0.025, H: 320},
		fgDark:             color.OKLCH{L: 0.90, C: 0.060, H: 190},
		fgLight:            color.OKLCH{L: 0.26, C: 0.060, H: 310},
		ansiHueAnchor:      320,
		ansiTintStrength:   0.28,
		ansiChromaMin:      0.10,
		ansiChromaMax:      0.16,
		ansiLightnessDark:  0.74,
		ansiLightnessLight: 0.52,
		stagger:            [6]float64{-0.04, +0.02, +0.06, -0.03, -0.01, +0.04},
	})
}

// GenerateMidnightPalette: peaceful deep-night — indigo bg, silver fg, subdued ANSI.
// Distinct from Neon (no glow) and Ocean (less blue, more violet). The dim L target and
// low chroma create a "calm late-night" feel rather than vibrant or immersive.
func GenerateMidnightPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.07, C: 0.035, H: 250},
		bgLight:            color.OKLCH{L: 0.95, C: 0.020, H: 240},
		fgDark:             color.OKLCH{L: 0.88, C: 0.020, H: 220},
		fgLight:            color.OKLCH{L: 0.22, C: 0.045, H: 250},
		ansiHueAnchor:      250,
		ansiTintStrength:   0.20,
		ansiChromaMin:      0.07,
		ansiChromaMax:      0.12,
		ansiLightnessDark:  0.62,
		ansiLightnessLight: 0.42,
		stagger:            [6]float64{-0.04, +0.01, +0.05, -0.03, -0.02, +0.03},
	})
}

// GenerateAuroraPalette: northern-lights shimmer — deep blue-night bg, cool teal fg,
// strongly tinted ANSI in the aurora hue band (green-cyan-violet). High tint pulls every
// slot into the aurora palette so the mood character dominates over image identity.
func GenerateAuroraPalette(dominantColors []string, lightMode bool) [16]string {
	return moodPalette(dominantColors, lightMode, moodSpec{
		bgDark:             color.OKLCH{L: 0.08, C: 0.045, H: 240},
		bgLight:            color.OKLCH{L: 0.96, C: 0.025, H: 220},
		fgDark:             color.OKLCH{L: 0.92, C: 0.040, H: 175},
		fgLight:            color.OKLCH{L: 0.20, C: 0.055, H: 240},
		ansiHueAnchor:      160,
		ansiTintStrength:   0.42,
		ansiChromaMin:      0.12,
		ansiChromaMax:      0.18,
		ansiLightnessDark:  0.70,
		ansiLightnessLight: 0.50,
		stagger:            [6]float64{-0.05, +0.02, +0.06, -0.03, -0.01, +0.04},
	})
}
