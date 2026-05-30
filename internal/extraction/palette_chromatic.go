package extraction

import (
	"math"

	"aether/internal/color"
)

// extractChromaticHues fills slots 0 (bg), 7 (fg), and 1-6 (ANSI) using image-derived
// colors. Slots 8 and 9-15 are left empty — pass through finalizePalette to fill them.
// Mode transforms call this directly when they intend to overwrite bg/fg/ANSI in OKLCH,
// avoiding wasted slot 8/9-15 generation that the full chromatic pipeline would do.
// Slot 1-6 are taken verbatim from the image's best matches; no canonical-hue synthesis.
// weights (optional, aligned with dominantColors) biases bg/fg selection toward colors
// that cover more of the image; pass nil to select by pure lightness extremity.
func extractChromaticHues(dominantColors []string, weights []float64, lightMode bool) [16]string {
	topCount := 12
	if len(dominantColors) < topCount {
		topCount = len(dominantColors)
	}
	topColors := dominantColors[:topCount]

	// topColors/topWeights are prefix slices of the full lists (weights aligns 1:1
	// with dominantColors), so the index FindBackgroundColor returns is valid in the
	// full dominantColors list.
	var topWeights []float64
	if weights != nil {
		topWeights = weights[:topCount]
	}

	bgColor, bgIndex := FindBackgroundColor(topColors, topWeights, lightMode)
	bgColor = synthesizeBgIfTooMid(bgColor, lightMode)
	usedIndices := map[int]bool{bgIndex: true}

	fgColor, fgIndex := FindForegroundColor(dominantColors, weights, lightMode, bgColor, usedIndices)
	if fgIndex >= 0 {
		usedIndices[fgIndex] = true
	}

	var palette [16]string
	palette[0] = bgColor
	palette[7] = fgColor

	// ExtractColors guarantees len(dominantColors) ≥ 8 and at most 2 are pre-claimed
	// for bg/fg, so FindOptimalAnsiAssignment always fills all 6 ANSI slots.
	assignments := FindOptimalAnsiAssignment(dominantColors, usedIndices, lightMode)
	for i := 0; i < 6; i++ {
		palette[i+1] = dominantColors[assignments[i].PoolIndex]
		usedIndices[assignments[i].PoolIndex] = true
	}

	return palette
}

// synthesizeBgIfTooMid replaces a mid-lightness image bg with a synthesized OKLCH
// color at a sane bg lightness, preserving hue. Without this, images with no truly
// dark/light pixels (e.g. a sunset photo or a Nord-themed wallpaper) produce muddy
// backgrounds. Chroma is loosely capped — saturated bg's stay visibly tinted.
func synthesizeBgIfTooMid(bgColor string, lightMode bool) string {
	lch := color.HexToOKLCH(bgColor)
	if lightMode {
		if lch.L >= 0.85 {
			return bgColor
		}
		return color.OKLCHToHex(color.OKLCH{L: 0.94, C: math.Min(lch.C, 0.04), H: lch.H})
	}
	if lch.L <= 0.20 {
		return bgColor
	}
	return color.OKLCHToHex(color.OKLCH{L: 0.12, C: math.Min(lch.C, 0.05), H: lch.H})
}

// GenerateChromaticPalette: vibrant chromatic palette from image-derived hues.
// OKLCH-based optimal assignment for slots 1-6, contrast-aware bg/fg. weights
// (optional, aligned with dominantColors) makes bg/fg coverage-aware.
// normalizeChromaticAccents makes the picked accents usable (pop to the image's
// salient saturation, distinct), then finalizePalette derives slots 8/9-15 and
// enforces AA contrast.
func GenerateChromaticPalette(dominantColors []string, weights []float64, lightMode bool) [16]string {
	palette := extractChromaticHues(dominantColors, weights, lightMode)
	normalizeChromaticAccents(&palette, dominantColors, weights, lightMode)
	finalizePalette(&palette)
	return palette
}

// hueCluster is a populated band in the image's coverage-weighted hue histogram:
// a hue that real, chromatic pixels actually occupy, with how much of the frame.
type hueCluster struct {
	hue      float64
	coverage float64
}

// supportedHueClusters bins the chromatic dominant colors into a coverage-weighted
// hue histogram and returns the clusters that carry at least MinAccentHueSupport of
// the frame. These are the only hues an accent is allowed to use: a hue with no
// cluster (a few stray cool pixels in a warm scene) is something the wallpaper
// doesn't really contain, so promoting it to a full ANSI accent reads as invented.
// weights is the per-dominant coverage share (may be nil → equal weighting).
func supportedHueClusters(dominantColors []string, weights []float64) []hueCluster {
	const bins = 12 // 30-degree bands
	var binW, binSin, binCos [bins]float64
	for k, c := range dominantColors {
		lch := color.HexToOKLCH(c)
		if lch.C < AccentSupportChroma {
			continue
		}
		w := 1.0 / float64(len(dominantColors))
		if weights != nil && k < len(weights) {
			w = weights[k]
		}
		b := int(lch.H/30) % bins
		if b < 0 {
			b += bins
		}
		rad := lch.H * math.Pi / 180
		binW[b] += w
		binSin[b] += math.Sin(rad) * w
		binCos[b] += math.Cos(rad) * w
	}
	var out []hueCluster
	for b := 0; b < bins; b++ {
		if binW[b] >= MinAccentHueSupport {
			h := math.Mod(math.Atan2(binSin[b], binCos[b])*180/math.Pi+360, 360)
			out = append(out, hueCluster{hue: h, coverage: binW[b]})
		}
	}
	return out
}

// nearestClusterHue returns the supported-cluster hue closest to target, or
// (0,false) when the image has no supported chromatic cluster at all.
func nearestClusterHue(target float64, clusters []hueCluster) (float64, bool) {
	best := math.Inf(1)
	var bestHue float64
	for _, c := range clusters {
		if d := CalculateHueDistance(target, c.hue); d < best {
			best = d
			bestHue = c.hue
		}
	}
	return bestHue, len(clusters) > 0
}

// normalizeChromaticAccents makes the image-derived ANSI accents (slots 1-6) usable
// as a terminal palette without drifting from the wallpaper. The default chromatic
// path takes accents verbatim from median-cut bucket averages and FindOptimalAnsiAssignment
// fills all six canonical hue slots, so on a hue-limited image it (a) returns muddy
// near-gray picks for absent hues and (b) promotes a tiny minority hue (a few cool
// pixels in a warm scene) into a full accent. Both read as colors the wallpaper
// doesn't contain. This pass constrains every accent to the image's actual hue
// gamut, using a coverage-weighted hue histogram (supportedHueClusters):
//
//   - an accent whose hue lands in a populated cluster is kept (a genuine image hue);
//   - an accent that is near-gray (hue is quantization noise) OR whose hue has no
//     coverage support (a minority/invented hue) is folded to the nearest supported
//     cluster hue — so a warm image's "blue"/"cyan" slots become warm in-family
//     accents instead of a fabricated cool color, exactly the monochrome principle;
//   - if the image has no supported chromatic cluster at all, near-gray slots stay
//     neutral rather than inventing a hue;
//   - chroma is then lifted toward the image's salient saturation so accents pop;
//   - finally any two near-identical accents are separated by lightness only.
//
// Multi-hue wallpapers (every slot lands in a real cluster) are left untouched and
// keep their full, vibrant range.
func normalizeChromaticAccents(p *[16]string, dominantColors []string, weights []float64, lightMode bool) {
	target := clampF(salientChroma(dominantColors)*0.85, AccentChromaFloor, AccentChromaCeil)
	clusters := supportedHueClusters(dominantColors, weights)

	for i := 1; i <= 6; i++ {
		lch := color.HexToOKLCH(p[i])
		grayPick := lch.C < NearAchromaticChroma
		supported := false
		for _, cl := range clusters {
			if CalculateHueDistance(lch.H, cl.hue) <= HueSupportTol {
				supported = true
				break
			}
		}
		if grayPick || !supported {
			if h, ok := nearestClusterHue(OKLCHAnsiHues[i-1], clusters); ok {
				lch.H = h // fold into the wallpaper's nearest real hue cluster
			} else if grayPick {
				lch.C = 0 // no chromatic content at all: stay neutral
			}
		}
		if lch.C > 0 && lch.C < target {
			lch.C = target
		}
		p[i] = color.OKLCHToHex(lch)
	}

	// Lightness-only distinctness pass: nudge a colliding accent away from its peer.
	for i := 1; i <= 6; i++ {
		for j := i + 1; j <= 6; j++ {
			if color.OKLabDistance(color.HexToOKLab(p[i]), color.HexToOKLab(p[j])) < AccentMinDeltaE {
				lch := color.HexToOKLCH(p[j])
				if lightMode {
					lch.L = clampF(lch.L-0.10, 0.20, 0.85)
				} else {
					lch.L = clampF(lch.L+0.10, 0.30, 0.92)
				}
				p[j] = color.OKLCHToHex(lch)
			}
		}
	}
}

// generateCommentColor creates a gray/muted color for code comments (ANSI color 8)
// that has adequate contrast against the background.
func generateCommentColor(bgColor string) string {
	bgLab := color.HexToOKLab(bgColor)
	bgLch := color.OKLabToOKLCH(bgLab)

	var targetL float64
	if bgLab.L < 0.5 {
		// Dark background: comments should be medium-light gray
		targetL = math.Min(1.0, bgLab.L+0.30)
	} else {
		// Light background: comments should be medium-dark gray
		targetL = math.Max(0.0, bgLab.L-0.30)
	}

	// Subtle tint from background hue for cohesion
	commentChroma := 0.01
	commentColor := color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})

	// Verify contrast; adjust if needed
	contrast := color.ContrastRatio(bgColor, commentColor)
	if contrast < MinCommentContrast {
		step := 0.05
		if bgLab.L < 0.5 {
			for targetL < 0.95 && contrast < MinCommentContrast {
				targetL += step
				commentColor = color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})
				contrast = color.ContrastRatio(bgColor, commentColor)
			}
		} else {
			for targetL > 0.05 && contrast < MinCommentContrast {
				targetL -= step
				commentColor = color.OKLCHToHex(color.OKLCH{L: targetL, C: commentChroma, H: bgLch.H})
				contrast = color.ContrastRatio(bgColor, commentColor)
			}
		}
	}

	return commentColor
}

// boostContrastAgainstBg adjusts a color's OKLab lightness until it meets targetRatio
// against the background, preserving hue and chroma.
func boostContrastAgainstBg(hex, bgColor string, targetRatio float64) string {
	lab := color.HexToOKLab(hex)
	lch := color.OKLabToOKLCH(lab)
	bgLab := color.HexToOKLab(bgColor)

	step := 0.03
	if bgLab.L < 0.5 {
		for lch.L < 0.95 {
			lch.L += step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= targetRatio {
				return candidate
			}
		}
	} else {
		for lch.L > 0.05 {
			lch.L -= step
			candidate := color.OKLCHToHex(lch)
			if color.ContrastRatio(bgColor, candidate) >= targetRatio {
				return candidate
			}
		}
	}

	return color.OKLCHToHex(lch)
}
