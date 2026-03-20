package extraction

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"aether/internal/color"
)

// ColorBucket represents a group of colors for the median-cut algorithm.
type ColorBucket struct {
	Colors []color.RGB
	Ranges [3][2]float64 // [channel][min, max] where channel 0=R, 1=G, 2=B
}

// NewColorBucket creates a new ColorBucket and computes its channel ranges.
func NewColorBucket(colors []color.RGB) *ColorBucket {
	b := &ColorBucket{Colors: colors}
	b.computeRanges()
	return b
}

// computeRanges computes the min/max for each channel (R, G, B).
func (b *ColorBucket) computeRanges() {
	if len(b.Colors) == 0 {
		b.Ranges = [3][2]float64{{0, 0}, {0, 0}, {0, 0}}
		return
	}

	first := b.Colors[0]
	b.Ranges = [3][2]float64{
		{first.R, first.R},
		{first.G, first.G},
		{first.B, first.B},
	}

	for _, c := range b.Colors {
		vals := [3]float64{c.R, c.G, c.B}
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

// channelRange returns max - min for a given channel.
func (b *ColorBucket) channelRange(ch int) float64 {
	return b.Ranges[ch][1] - b.Ranges[ch][0]
}

// LongestChannel returns the channel index (0=R, 1=G, 2=B) with the widest range.
func (b *ColorBucket) LongestChannel() int {
	rRange := b.channelRange(0)
	gRange := b.channelRange(1)
	bRange := b.channelRange(2)

	if rRange >= gRange && rRange >= bRange {
		return 0
	}
	if gRange >= bRange {
		return 1
	}
	return 2
}

// Split splits the bucket along its longest channel at the median point.
func (b *ColorBucket) Split() (*ColorBucket, *ColorBucket) {
	ch := b.LongestChannel()

	sort.Slice(b.Colors, func(i, j int) bool {
		return channelValue(b.Colors[i], ch) < channelValue(b.Colors[j], ch)
	})

	mid := len(b.Colors) / 2
	left := make([]color.RGB, mid)
	right := make([]color.RGB, len(b.Colors)-mid)
	copy(left, b.Colors[:mid])
	copy(right, b.Colors[mid:])

	return NewColorBucket(left), NewColorBucket(right)
}

// AverageColor returns the average color of the bucket and its pixel count.
func (b *ColorBucket) AverageColor() (color.RGB, int) {
	count := len(b.Colors)
	if count == 0 {
		return color.RGB{R: 0, G: 0, B: 0}, 0
	}

	var rSum, gSum, bSum float64
	for _, c := range b.Colors {
		rSum += c.R
		gSum += c.G
		bSum += c.B
	}

	return color.RGB{
		R: math.Round(rSum / float64(count)),
		G: math.Round(gSum / float64(count)),
		B: math.Round(bSum / float64(count)),
	}, count
}

// Volume returns the volume of this bucket, used for prioritising splits.
// Larger volume means more color variation.
func (b *ColorBucket) Volume() float64 {
	return b.channelRange(0) * b.channelRange(1) * b.channelRange(2) * float64(len(b.Colors))
}

// channelValue extracts the value of a specific channel (0=R, 1=G, 2=B) from an RGB color.
func channelValue(c color.RGB, ch int) float64 {
	switch ch {
	case 0:
		return c.R
	case 1:
		return c.G
	default:
		return c.B
	}
}

// colorEntry holds an average color and its pixel count.
type colorEntry struct {
	Color color.RGB
	Count int
}

// MedianCut performs median-cut color quantization on a set of RGB colors.
// It iteratively splits the bucket with the largest volume until numColors buckets exist.
// Returns a slice of {Color, Count} sorted by count descending.
func MedianCut(colors []color.RGB, numColors int) []colorEntry {
	if len(colors) == 0 {
		return nil
	}

	if len(colors) <= numColors {
		return deduplicateColors(colors)
	}

	buckets := []*ColorBucket{NewColorBucket(colors)}

	for len(buckets) < numColors {
		splitIdx := findLargestSplittableBucket(buckets)
		if splitIdx == -1 {
			break
		}

		left, right := buckets[splitIdx].Split()
		// Replace the split bucket with left and right
		newBuckets := make([]*ColorBucket, 0, len(buckets)+1)
		newBuckets = append(newBuckets, buckets[:splitIdx]...)
		newBuckets = append(newBuckets, left, right)
		newBuckets = append(newBuckets, buckets[splitIdx+1:]...)
		buckets = newBuckets
	}

	var result []colorEntry
	for _, bucket := range buckets {
		avg, count := bucket.AverageColor()
		if count > 0 {
			result = append(result, colorEntry{Color: avg, Count: count})
		}
	}

	return result
}

// ExtractDominantColors loads an image, samples its pixels, runs median-cut quantization,
// and returns hex color strings (uppercase) sorted by dominance.
func ExtractDominantColors(imagePath string, numColors int) ([]string, error) {
	pixels, err := LoadAndSamplePixels(imagePath)
	if err != nil {
		return nil, err
	}

	if len(pixels) < MinPixelsToSample/10 {
		return nil, fmt.Errorf("not enough pixels to extract colors")
	}

	quantized := MedianCut(pixels, numColors)
	if len(quantized) == 0 {
		return nil, fmt.Errorf("no colors extracted from image")
	}

	// Sort by count (dominance) descending
	sort.Slice(quantized, func(i, j int) bool {
		return quantized[i].Count > quantized[j].Count
	})

	hexColors := make([]string, len(quantized))
	for i, entry := range quantized {
		hex := color.RGBToHex(entry.Color.R, entry.Color.G, entry.Color.B)
		hexColors[i] = strings.ToUpper(hex)
	}

	return hexColors, nil
}

// deduplicateColors removes duplicate RGB colors and returns unique entries.
func deduplicateColors(colors []color.RGB) []colorEntry {
	seen := make(map[string]bool)
	var unique []colorEntry

	for _, c := range colors {
		key := fmt.Sprintf("%v,%v,%v", c.R, c.G, c.B)
		if !seen[key] {
			seen[key] = true
			unique = append(unique, colorEntry{Color: c, Count: 1})
		}
	}

	return unique
}

// findLargestSplittableBucket finds the bucket with the largest volume that has >1 colors.
// Returns -1 if no bucket can be split.
func findLargestSplittableBucket(buckets []*ColorBucket) int {
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
