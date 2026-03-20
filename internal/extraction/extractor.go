package extraction

import (
	"fmt"
)

// ExtractColors extracts colors from a wallpaper image and generates a 16-color ANSI palette.
// Mode can be: "normal", "monochromatic", "analogous", "pastel", "material", "colorful", "muted", "bright".
// In "normal" mode, it auto-detects whether the image is monochrome or chromatic.
func ExtractColors(imagePath string, lightMode bool, mode string) ([16]string, error) {
	// Check cache first
	cacheKey := GetCacheKey(imagePath, lightMode)
	if mode != "normal" && cacheKey != "" {
		cacheKey = cacheKey + "_" + mode
	}

	if cacheKey != "" {
		if cached, ok := LoadCachedPalette(cacheKey); ok {
			return cached, nil
		}
	}

	// Extract dominant colors
	dominantColors, err := ExtractDominantColors(imagePath, DominantColorsToExtract)
	if err != nil {
		return [16]string{}, fmt.Errorf("color extraction failed: %w", err)
	}

	if len(dominantColors) < 8 {
		return [16]string{}, fmt.Errorf("not enough colors extracted from image")
	}

	var palette [16]string

	switch mode {
	case "monochromatic":
		palette = GenerateMonochromaticPalette(dominantColors, lightMode)
	case "analogous":
		palette = GenerateAnalogousPalette(dominantColors, lightMode)
	case "pastel":
		palette = GeneratePastelPalette(dominantColors, lightMode)
	case "material":
		palette = GenerateMaterialPalette(dominantColors, lightMode)
	case "colorful":
		palette = GenerateColorfulPalette(dominantColors, lightMode)
	case "muted":
		palette = GenerateMutedPalette(dominantColors, lightMode)
	case "bright":
		palette = GenerateBrightPalette(dominantColors, lightMode)
	default:
		// "normal" mode - auto-detect
		if IsMonochromeImage(dominantColors) {
			palette = GenerateMonochromePalette(dominantColors, lightMode)
		} else {
			palette = GenerateChromaticPalette(dominantColors, lightMode)
		}
	}

	// Normalize brightness for readability
	palette = NormalizeBrightness(palette)

	// Save to cache
	if cacheKey != "" {
		SavePaletteToCache(cacheKey, palette)
	}

	return palette, nil
}
