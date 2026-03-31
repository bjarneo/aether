package extraction

import (
	"math"
	"sort"

	"aether/internal/color"
)

// IsDarkColor determines if a color is considered "dark" using OKLab perceptual lightness.
func IsDarkColor(hex string) bool {
	lab := color.HexToOKLab(hex)
	return lab.L < DarkColorThreshold
}

// CalculateHueDistance calculates the circular distance between two hues (works for both HSL and OKLCH).
// Handles wraparound at 360 degrees and returns a value between 0 and 180.
func CalculateHueDistance(hue1, hue2 float64) float64 {
	diff := math.Abs(hue1 - hue2)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}

// IsMonochromeImage detects whether the extracted colors are mostly monochrome/grayscale
// using OKLCH chroma (perceptually accurate colorfulness metric).
// Returns true if more than 70% of colors have chroma below the threshold.
func IsMonochromeImage(colors []string) bool {
	lowChromaCount := 0

	for _, c := range colors {
		lch := color.HexToOKLCH(c)
		if lch.C < MonochromeChromaThreshold {
			lowChromaCount++
		}
	}

	return float64(lowChromaCount)/float64(len(colors)) > MonochromeImageThreshold
}

// findColorByPerceptualLightness finds a color by OKLab perceptual lightness extremity.
// If findLightest is true, returns the lightest; otherwise the darkest.
func findColorByPerceptualLightness(colors []string, findLightest bool, excludeIndices map[int]bool) (string, int) {
	bestIndex := 0
	bestLightness := 2.0 // Above max (1.0) to ensure any real value wins
	if findLightest {
		bestLightness = -1.0
	}

	for i := 0; i < len(colors); i++ {
		if excludeIndices != nil && excludeIndices[i] {
			continue
		}

		lab := color.HexToOKLab(colors[i])
		var isBetter bool
		if findLightest {
			isBetter = lab.L > bestLightness
		} else {
			isBetter = lab.L < bestLightness
		}

		if isBetter {
			bestLightness = lab.L
			bestIndex = i
		}
	}

	return colors[bestIndex], bestIndex
}

// FindBackgroundColor finds the background color using OKLab perceptual lightness.
// Dark mode: darkest. Light mode: lightest.
func FindBackgroundColor(colors []string, lightMode bool) (string, int) {
	return findColorByPerceptualLightness(colors, lightMode, nil)
}

// FindForegroundColor finds the foreground color (opposite of background).
// Also enforces minimum contrast ratio against the background.
func FindForegroundColor(colors []string, lightMode bool, bgColor string, usedIndices map[int]bool) (string, int) {
	// First, find by lightness extremity
	fgColor, fgIndex := findColorByPerceptualLightness(colors, !lightMode, usedIndices)

	// Check contrast ratio; if insufficient, synthesize a better foreground
	contrast := color.ContrastRatio(bgColor, fgColor)
	if contrast >= MinFgBgContrast {
		return fgColor, fgIndex
	}

	// Try other candidates sorted by contrast
	type candidate struct {
		index    int
		contrast float64
	}
	var candidates []candidate
	for i, c := range colors {
		if usedIndices != nil && usedIndices[i] {
			continue
		}
		cr := color.ContrastRatio(bgColor, c)
		if cr > contrast {
			candidates = append(candidates, candidate{index: i, contrast: cr})
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].contrast > candidates[j].contrast
	})

	if len(candidates) > 0 && candidates[0].contrast >= MinContrastRatio {
		return colors[candidates[0].index], candidates[0].index
	}

	// Fallback: adjust the original fg to meet contrast
	bgLab := color.HexToOKLab(bgColor)
	fgLab := color.HexToOKLab(fgColor)
	if bgLab.L < 0.5 {
		// Dark bg: push fg lighter
		fgLab.L = math.Min(1.0, bgLab.L+0.65)
	} else {
		// Light bg: push fg darker
		fgLab.L = math.Max(0.0, bgLab.L-0.65)
	}
	adjustedHex := color.OKLabToHex(fgLab)
	return adjustedHex, fgIndex
}

// CalculateColorScore calculates a color quality score for ANSI color selection
// using OKLCH perceptual color space. Lower score = better match.
func CalculateColorScore(lch color.OKLCH, targetHue float64) float64 {
	// Hue accuracy in perceptually uniform OKLCH space
	hueScore := CalculateHueDistance(lch.H, targetHue) * 2.0

	// Chroma preference - strongly prefer chromatic colors
	var chromaScore float64
	if lch.C < MinChromaForAnsiMatch {
		chromaScore = 80 // Heavy penalty for near-gray
	} else if lch.C < 0.05 {
		chromaScore = 40
	} else if lch.C < IdealChromaMin {
		chromaScore = 15
	} else if lch.C <= IdealChromaMax {
		chromaScore = 0 // Ideal range - no penalty
	} else {
		chromaScore = (lch.C - IdealChromaMax) * 50 // Mild penalty for very vivid
	}

	// Lightness suitability - prefer mid-range, penalize extremes
	// OKLab L is perceptually linear, so these thresholds are meaningful
	var lightnessScore float64
	if lch.L < TooDarkLightness {
		lightnessScore = (TooDarkLightness - lch.L) * 200
	} else if lch.L > TooBrightLightness {
		lightnessScore = (lch.L - TooBrightLightness) * 150
	} else {
		// Slight preference for L around 0.55-0.65 (good readability zone)
		lightnessScore = math.Abs(lch.L-0.60) * 20
	}

	return hueScore + chromaScore + lightnessScore
}

// FindBestColorMatch finds the best matching color for a specific ANSI color role
// using OKLCH-based scoring. Returns the index of the best match in colorPool.
func FindBestColorMatch(targetHue float64, colorPool []string, usedIndices map[int]bool) int {
	bestIndex := -1
	bestScore := math.Inf(1)

	for i := 0; i < len(colorPool); i++ {
		if usedIndices[i] {
			continue
		}

		lch := color.HexToOKLCH(colorPool[i])
		score := CalculateColorScore(lch, targetHue)

		if score < bestScore {
			bestScore = score
			bestIndex = i
		}
	}

	if bestIndex != -1 {
		return bestIndex
	}
	return 0
}

// GenerateBrightVersion generates a perceptually lighter version of a color for bright ANSI slots.
// Works in OKLab space so the boost is perceptually uniform.
func GenerateBrightVersion(hex string) string {
	lab := color.HexToOKLab(hex)
	lch := color.OKLabToOKLCH(lab)

	// Scale boost based on available headroom
	headroom := 0.92 - lab.L
	boost := math.Max(0.04, math.Min(BrightColorLightnessBoost, headroom*0.6))
	newL := math.Min(0.92, lab.L+boost)

	// Slight chroma boost for vibrancy
	newC := math.Min(0.3, lch.C*BrightColorSaturationBoost)

	return color.OKLCHToHex(color.OKLCH{L: newL, C: newC, H: lch.H})
}

// AdjustColorLightness adjusts a color to the given target OKLab lightness (0-1).
func AdjustColorLightness(hex string, targetLightness float64) string {
	lab := color.HexToOKLab(hex)
	lab.L = targetLightness
	return color.OKLabToHex(lab)
}

// AdjustColorLightnessHSL adjusts a color using HSL lightness (0-100) for legacy compatibility.
func AdjustColorLightnessHSL(hex string, targetLightness float64) string {
	hsl := color.HexToHSL(hex)
	return color.HSLToHex(hsl.H, hsl.S, targetLightness)
}

// ColorLightnessInfo holds a color with its perceptual lightness and hue.
type ColorLightnessInfo struct {
	Color     string
	Lightness float64 // OKLab L (0-1)
	Hue       float64 // OKLCH H (0-360)
}

// SortColorsByLightness sorts colors by OKLab perceptual lightness ascending.
func SortColorsByLightness(colors []string) []ColorLightnessInfo {
	result := make([]ColorLightnessInfo, len(colors))
	for i, c := range colors {
		lch := color.HexToOKLCH(c)
		result[i] = ColorLightnessInfo{Color: c, Lightness: lch.L, Hue: lch.H}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Lightness < result[j].Lightness
	})

	return result
}

// SynthesizeAnsiColor synthesizes an ANSI color when no good match exists in the image.
// Uses the average chroma and lightness of already-assigned colors (in OKLCH) to create
// a color that fits the palette's visual mood.
func SynthesizeAnsiColor(targetHue float64, existingColors []string) string {
	var totalC, totalL float64
	count := 0

	for _, c := range existingColors {
		if c == "" {
			continue
		}
		lch := color.HexToOKLCH(c)
		if lch.C >= MinChromaForAnsiMatch {
			totalC += lch.C
			totalL += lch.L
			count++
		}
	}

	avgC := 0.10 // Default chroma for synthesis
	avgL := 0.60 // Default lightness
	if count > 0 {
		avgC = totalC / float64(count)
		avgL = totalL / float64(count)
	}

	// Clamp to sane ranges
	synC := math.Max(0.06, math.Min(0.18, avgC))
	synL := math.Max(0.40, math.Min(0.75, avgL))

	return color.OKLCHToHex(color.OKLCH{L: synL, C: synC, H: targetHue})
}

// AnsiAssignment represents the assignment of a pool color to an ANSI slot.
type AnsiAssignment struct {
	PoolIndex int
	Score     float64
}

// FindOptimalAnsiAssignment finds optimal ANSI color assignments using OKLCH-based
// global greedy matching. Instead of assigning colors sequentially, this finds the
// globally best (ANSI slot, color) pair at each step, preventing earlier slots from
// stealing good matches from later ones.
func FindOptimalAnsiAssignment(colorPool []string, usedIndices map[int]bool) [6]*AnsiAssignment {
	type candidate struct {
		poolIndex int
		score     float64
	}

	// Pre-compute and sort scores for all (ANSI slot, color) pairs using OKLCH hue targets
	allScores := make([][]*candidate, 6)
	for a := 0; a < 6; a++ {
		targetHue := OKLCHAnsiHues[a]
		candidates := make([]*candidate, len(colorPool))
		for i, c := range colorPool {
			if usedIndices[i] {
				candidates[i] = &candidate{poolIndex: i, score: math.Inf(1)}
			} else {
				lch := color.HexToOKLCH(c)
				candidates[i] = &candidate{poolIndex: i, score: CalculateColorScore(lch, targetHue)}
			}
		}
		sort.Slice(candidates, func(i, j int) bool {
			return candidates[i].score < candidates[j].score
		})
		allScores[a] = candidates
	}

	var assignments [6]*AnsiAssignment
	assignedPoolIndices := make(map[int]bool)
	for k, v := range usedIndices {
		assignedPoolIndices[k] = v
	}

	// Iteratively assign the globally best pair
	for round := 0; round < 6; round++ {
		bestAnsi := -1
		bestPoolIndex := -1
		bestScore := math.Inf(1)

		for a := 0; a < 6; a++ {
			if assignments[a] != nil {
				continue
			}
			for _, cand := range allScores[a] {
				if assignedPoolIndices[cand.poolIndex] {
					continue
				}
				if cand.score < bestScore {
					bestScore = cand.score
					bestAnsi = a
					bestPoolIndex = cand.poolIndex
				}
				break // First unassigned is best (list is sorted)
			}
		}

		if bestAnsi == -1 {
			break
		}
		assignments[bestAnsi] = &AnsiAssignment{PoolIndex: bestPoolIndex, Score: bestScore}
		assignedPoolIndices[bestPoolIndex] = true
	}

	return assignments
}
