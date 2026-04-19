package extraction

import (
	"fmt"

	"aether/internal/color"
	"aether/internal/theme"
)

// ExtractColorsFromImages blends multiple images into a single 16-color palette
// by sampling pixels from each image and concatenating them before quantization.
// Non-image inputs and unreadable files are skipped; the second return value is
// the count of skipped paths, intended for UI feedback. Callers should resolve
// video paths to extracted frames before calling this (the extraction package
// does not decode video).
func ExtractColorsFromImages(imagePaths []string, lightMode bool, mode string) ([16]string, int, error) {
	if len(imagePaths) == 0 {
		return [16]string{}, 0, fmt.Errorf("no images provided")
	}

	cacheKey := buildCacheKey(GetMultiCacheKey(imagePaths, lightMode), mode)
	if cacheKey != "" {
		if cached, ok := LoadCachedPalette(cacheKey); ok {
			return cached, 0, nil
		}
	}

	var allPixels []color.RGB
	skipped := 0
	for _, p := range imagePaths {
		if p == "" || !theme.IsImageFile(p) {
			skipped++
			continue
		}
		px, err := LoadAndSamplePixels(p)
		if err != nil {
			skipped++
			continue
		}
		allPixels = append(allPixels, px...)
	}

	dominantColors, err := ExtractDominantColorsFromPixels(allPixels, DominantColorsToExtract)
	if err != nil {
		return [16]string{}, skipped, fmt.Errorf("color extraction failed: %w", err)
	}
	if len(dominantColors) < 8 {
		return [16]string{}, skipped, fmt.Errorf("not enough colors extracted from images")
	}

	palette := NormalizeBrightness(GeneratePaletteByMode(dominantColors, lightMode, mode))

	if cacheKey != "" {
		SavePaletteToCache(cacheKey, palette)
	}
	return palette, skipped, nil
}
