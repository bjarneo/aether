package extraction

import (
	"math"
	"sort"

	"aether/internal/color"
)

// IsDarkColor determines if a color is considered "dark" based on its lightness.
func IsDarkColor(hex string) bool {
	return color.HexToHSL(hex).L < DarkColorThreshold
}

// CalculateHueDistance calculates the circular distance between two hues.
// Handles wraparound at 360 degrees and returns a value between 0 and 180.
func CalculateHueDistance(hue1, hue2 float64) float64 {
	diff := math.Abs(hue1 - hue2)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}

// IsMonochromeImage detects whether the extracted colors are mostly monochrome/grayscale.
// Returns true if more than 70% of colors have saturation below the threshold.
func IsMonochromeImage(colors []string) bool {
	lowSatCount := 0

	for _, c := range colors {
		hsl := color.HexToHSL(c)
		if hsl.S < MonochromeSaturationThreshold {
			lowSatCount++
		}
	}

	return float64(lowSatCount)/float64(len(colors)) > MonochromeImageThreshold
}

// findColorByLightness finds a color by lightness extremity.
// If findLightest is true, returns the lightest; otherwise the darkest.
// excludeIndices is a set of indices to skip.
func findColorByLightness(colors []string, findLightest bool, excludeIndices map[int]bool) (string, int) {
	bestIndex := 0
	bestLightness := 101.0
	if findLightest {
		bestLightness = -1.0
	}

	for i := 0; i < len(colors); i++ {
		if excludeIndices != nil && excludeIndices[i] {
			continue
		}

		hsl := color.HexToHSL(colors[i])
		var isBetter bool
		if findLightest {
			isBetter = hsl.L > bestLightness
		} else {
			isBetter = hsl.L < bestLightness
		}

		if isBetter {
			bestLightness = hsl.L
			bestIndex = i
		}
	}

	return colors[bestIndex], bestIndex
}

// FindBackgroundColor finds the background color - darkest for dark mode, lightest for light mode.
func FindBackgroundColor(colors []string, lightMode bool) (string, int) {
	return findColorByLightness(colors, lightMode, nil)
}

// FindForegroundColor finds the foreground color - opposite of background.
func FindForegroundColor(colors []string, lightMode bool, usedIndices map[int]bool) (string, int) {
	return findColorByLightness(colors, !lightMode, usedIndices)
}

// CalculateColorScore calculates a color quality score for ANSI color selection.
// Balances hue accuracy, saturation preference, and lightness suitability.
// Lower score = better match.
func CalculateColorScore(hsl color.HSL, targetHue float64) float64 {
	// Hue accuracy - primary factor
	hueScore := CalculateHueDistance(hsl.H, targetHue) * 2.5

	// Saturation preference - strongly prefer chromatic colors
	var satScore float64
	if hsl.S < AnsiMinSaturationForMatch {
		satScore = 80
	} else if hsl.S < 20 {
		satScore = 40
	} else if hsl.S < 30 {
		satScore = 15
	} else {
		satScore = math.Max(0, (50-hsl.S)*0.3)
	}

	// Lightness suitability - prefer mid-range, penalize extremes
	var lightnessScore float64
	if hsl.L < TooDarkThreshold {
		lightnessScore = (TooDarkThreshold - hsl.L) * 2.5
	} else if hsl.L > TooBrightThreshold {
		lightnessScore = (hsl.L - TooBrightThreshold) * 2
	} else {
		lightnessScore = math.Abs(hsl.L-55) * 0.2
	}

	return hueScore + satScore + lightnessScore
}

// FindBestColorMatch finds the best matching color for a specific ANSI color role.
// Returns the index of the best match in colorPool.
func FindBestColorMatch(targetHue float64, colorPool []string, usedIndices map[int]bool) int {
	bestIndex := -1
	bestScore := math.Inf(1)

	for i := 0; i < len(colorPool); i++ {
		if usedIndices[i] {
			continue
		}

		hsl := color.HexToHSL(colorPool[i])
		score := CalculateColorScore(hsl, targetHue)

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

// GenerateBrightVersion generates a lighter version of a color for bright ANSI slots.
// Scales the boost based on available headroom to avoid washing out bright colors.
func GenerateBrightVersion(hex string) string {
	hsl := color.HexToHSL(hex)
	headroom := 90 - hsl.L
	boost := math.Max(5, math.Min(BrightColorLightnessBoost, headroom*0.6))
	newLightness := math.Min(90, hsl.L+boost)
	newSaturation := math.Min(100, hsl.S*BrightColorSaturationBoost)
	return color.HSLToHex(hsl.H, newSaturation, newLightness)
}

// AdjustColorLightness adjusts a color to the given target lightness.
func AdjustColorLightness(hex string, targetLightness float64) string {
	hsl := color.HexToHSL(hex)
	return color.HSLToHex(hsl.H, hsl.S, targetLightness)
}

// ColorLightnessInfo holds a color with its lightness and hue values.
type ColorLightnessInfo struct {
	Color     string
	Lightness float64
	Hue       float64
}

// SortColorsByLightness sorts colors by lightness ascending.
func SortColorsByLightness(colors []string) []ColorLightnessInfo {
	result := make([]ColorLightnessInfo, len(colors))
	for i, c := range colors {
		hsl := color.HexToHSL(c)
		result[i] = ColorLightnessInfo{Color: c, Lightness: hsl.L, Hue: hsl.H}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Lightness < result[j].Lightness
	})

	return result
}

// SynthesizeAnsiColor synthesizes an ANSI color when no good match exists in the image.
// Uses the average saturation and lightness of already-assigned colors to create
// a color that fits the palette's visual mood.
func SynthesizeAnsiColor(targetHue float64, existingColors []string) string {
	var totalS, totalL float64
	count := 0

	for _, c := range existingColors {
		if c == "" {
			continue
		}
		hsl := color.HexToHSL(c)
		if hsl.S >= AnsiMinSaturationForMatch {
			totalS += hsl.S
			totalL += hsl.L
			count++
		}
	}

	avgS := 50.0
	avgL := 55.0
	if count > 0 {
		avgS = totalS / float64(count)
		avgL = totalL / float64(count)
	}

	synS := math.Max(35, math.Min(75, avgS))
	synL := math.Max(40, math.Min(70, avgL))

	return color.HSLToHex(targetHue, synS, synL)
}

// AnsiAssignment represents the assignment of a pool color to an ANSI slot.
type AnsiAssignment struct {
	PoolIndex int
	Score     float64
}

// FindOptimalAnsiAssignment finds optimal ANSI color assignments using global greedy matching.
// Instead of assigning colors sequentially, this finds the globally best (ANSI slot, color) pair
// at each step, preventing earlier slots from stealing good matches from later ones.
func FindOptimalAnsiAssignment(colorPool []string, usedIndices map[int]bool) [6]*AnsiAssignment {
	type candidate struct {
		poolIndex int
		score     float64
	}

	// Pre-compute and sort scores for all (ANSI slot, color) pairs
	allScores := make([][]*candidate, 6)
	for a := 0; a < 6; a++ {
		targetHue := ANSIHueArray[a]
		candidates := make([]*candidate, len(colorPool))
		for i, c := range colorPool {
			if usedIndices[i] {
				candidates[i] = &candidate{poolIndex: i, score: math.Inf(1)}
			} else {
				hsl := color.HexToHSL(c)
				candidates[i] = &candidate{poolIndex: i, score: CalculateColorScore(hsl, targetHue)}
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
			// Find best unassigned candidate for this slot
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
