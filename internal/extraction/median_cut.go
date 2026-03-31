package extraction

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"aether/internal/color"
)

// OKLabBucket represents a group of colors in OKLab perceptual space for median-cut.
type OKLabBucket struct {
	Colors []color.OKLab
	Ranges [3][2]float64 // [axis][min, max] where axis 0=L, 1=A, 2=B
}

// NewOKLabBucket creates a new bucket and computes its axis ranges.
func NewOKLabBucket(colors []color.OKLab) *OKLabBucket {
	b := &OKLabBucket{Colors: colors}
	b.computeRanges()
	return b
}

// computeRanges computes the min/max for each OKLab axis.
func (b *OKLabBucket) computeRanges() {
	if len(b.Colors) == 0 {
		b.Ranges = [3][2]float64{{0, 0}, {0, 0}, {0, 0}}
		return
	}

	first := b.Colors[0]
	b.Ranges = [3][2]float64{
		{first.L, first.L},
		{first.A, first.A},
		{first.B, first.B},
	}

	for _, c := range b.Colors {
		vals := [3]float64{c.L, c.A, c.B}
		for ch := 0; ch < 3; ch++ {
			if vals[ch] < b.Ranges[ch][0] {
				b.Ranges[ch][0] = vals[ch]
			}
			if vals[ch] > b.Ranges[ch][1] {
				b.Ranges[ch][1] = vals[ch]
			}
		}
	}
}

// axisRange returns max - min for a given axis.
func (b *OKLabBucket) axisRange(axis int) float64 {
	return b.Ranges[axis][1] - b.Ranges[axis][0]
}

// LongestAxis returns the axis index (0=L, 1=A, 2=B) with the widest perceptual range.
// Weights L slightly higher since lightness differences are the most perceptible.
func (b *OKLabBucket) LongestAxis() int {
	lRange := b.axisRange(0) * 1.2 // Weight lightness slightly higher
	aRange := b.axisRange(1)
	bRange := b.axisRange(2)

	if lRange >= aRange && lRange >= bRange {
		return 0
	}
	if aRange >= bRange {
		return 1
	}
	return 2
}

// Split splits the bucket along its longest axis at the median point.
func (b *OKLabBucket) Split() (*OKLabBucket, *OKLabBucket) {
	axis := b.LongestAxis()

	sort.Slice(b.Colors, func(i, j int) bool {
		return oklabAxisValue(b.Colors[i], axis) < oklabAxisValue(b.Colors[j], axis)
	})

	mid := len(b.Colors) / 2
	left := make([]color.OKLab, mid)
	right := make([]color.OKLab, len(b.Colors)-mid)
	copy(left, b.Colors[:mid])
	copy(right, b.Colors[mid:])

	return NewOKLabBucket(left), NewOKLabBucket(right)
}

// AverageColor returns the average color of the bucket in OKLab space and its pixel count.
// Averaging in OKLab produces perceptually natural intermediate colors.
func (b *OKLabBucket) AverageColor() (color.OKLab, int) {
	count := len(b.Colors)
	if count == 0 {
		return color.OKLab{}, 0
	}

	var lSum, aSum, bSum float64
	for _, c := range b.Colors {
		lSum += c.L
		aSum += c.A
		bSum += c.B
	}

	n := float64(count)
	return color.OKLab{
		L: lSum / n,
		A: aSum / n,
		B: bSum / n,
	}, count
}

// Volume returns the perceptual volume of this bucket.
// Larger volume = more perceptual color variation inside the bucket.
func (b *OKLabBucket) Volume() float64 {
	return b.axisRange(0) * b.axisRange(1) * b.axisRange(2) * float64(len(b.Colors))
}

// oklabAxisValue extracts a specific axis value from an OKLab color.
func oklabAxisValue(c color.OKLab, axis int) float64 {
	switch axis {
	case 0:
		return c.L
	case 1:
		return c.A
	default:
		return c.B
	}
}

// colorEntry holds an average color (as hex) and its pixel count.
type colorEntry struct {
	Hex   string
	Count int
}

// MedianCut performs median-cut color quantization in OKLab perceptual space.
// It iteratively splits the bucket with the largest perceptual volume until
// numColors buckets exist. Returns hex colors sorted by pixel count descending.
func MedianCut(colors []color.OKLab, numColors int) []colorEntry {
	if len(colors) == 0 {
		return nil
	}

	if len(colors) <= numColors {
		return deduplicateOKLabColors(colors)
	}

	buckets := []*OKLabBucket{NewOKLabBucket(colors)}

	for len(buckets) < numColors {
		splitIdx := findLargestSplittableOKLabBucket(buckets)
		if splitIdx == -1 {
			break
		}

		left, right := buckets[splitIdx].Split()
		newBuckets := make([]*OKLabBucket, 0, len(buckets)+1)
		newBuckets = append(newBuckets, buckets[:splitIdx]...)
		newBuckets = append(newBuckets, left, right)
		newBuckets = append(newBuckets, buckets[splitIdx+1:]...)
		buckets = newBuckets
	}

	var result []colorEntry
	for _, bucket := range buckets {
		avg, count := bucket.AverageColor()
		if count > 0 {
			hex := color.OKLabToHex(avg)
			result = append(result, colorEntry{Hex: hex, Count: count})
		}
	}

	return result
}

// ExtractDominantColors loads an image, samples its pixels, converts to OKLab,
// runs perceptual median-cut quantization, and returns hex colors sorted by dominance.
func ExtractDominantColors(imagePath string, numColors int) ([]string, error) {
	pixels, err := LoadAndSamplePixels(imagePath)
	if err != nil {
		return nil, err
	}

	if len(pixels) < MinPixelsToSample/10 {
		return nil, fmt.Errorf("not enough pixels to extract colors")
	}

	// Convert RGB pixels to OKLab for perceptual quantization
	oklabPixels := make([]color.OKLab, 0, len(pixels))
	for _, px := range pixels {
		oklabPixels = append(oklabPixels, color.RGBToOKLab(px))
	}

	// Boost chromatic pixels so colorful image regions aren't drowned out
	// by large uniform backgrounds (e.g., a sunset subject against a dark sky)
	boosted := boostChromaticPixels(oklabPixels)

	quantized := MedianCut(boosted, numColors)
	if len(quantized) == 0 {
		return nil, fmt.Errorf("no colors extracted from image")
	}

	// Sort by count (dominance) descending
	sort.Slice(quantized, func(i, j int) bool {
		return quantized[i].Count > quantized[j].Count
	})

	hexColors := make([]string, len(quantized))
	for i, entry := range quantized {
		hexColors[i] = strings.ToUpper(entry.Hex)
	}

	return hexColors, nil
}

// boostChromaticPixels duplicates pixels with high OKLCH chroma to give them
// more influence in median-cut. This ensures colorful image regions are properly
// represented even when dominated by large uniform backgrounds.
func boostChromaticPixels(pixels []color.OKLab) []color.OKLab {
	result := make([]color.OKLab, 0, len(pixels)*2)

	for _, px := range pixels {
		result = append(result, px)
		// Compute chroma (distance from neutral axis in a-b plane)
		chroma := math.Sqrt(px.A*px.A + px.B*px.B)
		if chroma > ChromaBoostThreshold {
			// Duplicate chromatic pixels to boost their representation
			for j := 1; j < ChromaBoostFactor; j++ {
				result = append(result, px)
			}
		}
	}

	return result
}

// deduplicateOKLabColors removes near-duplicate OKLab colors (within perceptual threshold).
func deduplicateOKLabColors(colors []color.OKLab) []colorEntry {
	var unique []colorEntry
	const threshold = 0.01 // Very close in OKLab = same color

	for _, c := range colors {
		isDuplicate := false
		for _, u := range unique {
			uLab := color.HexToOKLab(u.Hex)
			if color.OKLabDistance(c, uLab) < threshold {
				isDuplicate = true
				break
			}
		}
		if !isDuplicate {
			hex := color.OKLabToHex(c)
			unique = append(unique, colorEntry{Hex: hex, Count: 1})
		}
	}

	return unique
}

// findLargestSplittableOKLabBucket finds the bucket with the largest perceptual volume
// that has more than 1 color. Returns -1 if no bucket can be split.
func findLargestSplittableOKLabBucket(buckets []*OKLabBucket) int {
	maxVolume := 0.0
	maxIndex := -1

	for i, bucket := range buckets {
		if len(bucket.Colors) > 1 {
			volume := bucket.Volume()
			if volume > maxVolume {
				maxVolume = volume
				maxIndex = i
			}
		}
	}

	return maxIndex
}
