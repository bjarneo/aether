package extraction

import (
	"fmt"
)

// ExtractColors extracts colors from a wallpaper image and generates a 16-color ANSI palette.
// See GeneratePaletteByMode for the list of supported modes. In "normal" mode the extractor
// auto-detects whether the image is monochrome or chromatic.
func ExtractColors(imagePath string, lightMode bool, mode string) ([16]string, error) {
	cacheKey := buildCacheKey(GetCacheKey(imagePath, lightMode), mode)
	if cacheKey != "" {
		if cached, ok := LoadCachedPalette(cacheKey); ok {
			return cached, nil
		}
	}

	dominantColors, counts, err := ExtractDominantColors(imagePath, DominantColorsToExtract)
	if err != nil {
		return [16]string{}, fmt.Errorf("color extraction failed: %w", err)
	}
	if len(dominantColors) < 8 {
		return [16]string{}, fmt.Errorf("not enough colors extracted from image")
	}

	weights := normalizeCounts(counts)
	palette := NormalizeBrightness(GeneratePaletteByMode(dominantColors, weights, lightMode, mode))

	if cacheKey != "" {
		SavePaletteToCache(cacheKey, palette)
	}
	return palette, nil
}

// normalizeCounts turns per-color pixel counts into coverage shares in [0,1]
// (each count divided by the total). Returns nil for empty/zero input so callers
// fall back to lightness-only selection.
func normalizeCounts(counts []int) []float64 {
	total := 0
	for _, c := range counts {
		total += c
	}
	if total == 0 {
		return nil
	}
	weights := make([]float64, len(counts))
	for i, c := range counts {
		weights[i] = float64(c) / float64(total)
	}
	return weights
}

// GeneratePaletteByMode dispatches to the palette generator for a given mode.
// In "normal" mode, auto-detects between monochrome and chromatic generators.
// weights (optional, aligned with dominantColors) carries per-color image coverage;
// only the default chromatic path consumes it for coverage-aware bg/fg selection.
func GeneratePaletteByMode(dominantColors []string, weights []float64, lightMode bool, mode string) [16]string {
	switch mode {
	case "monochromatic":
		return GenerateMonochromaticPalette(dominantColors, lightMode)
	case "analogous":
		return GenerateAnalogousPalette(dominantColors, lightMode)
	case "pastel":
		return GeneratePastelPalette(dominantColors, lightMode)
	case "material":
		return GenerateMaterialPalette(dominantColors, lightMode)
	case "colorful":
		return GenerateColorfulPalette(dominantColors, lightMode)
	case "muted":
		return GenerateMutedPalette(dominantColors, lightMode)
	case "bright":
		return GenerateBrightPalette(dominantColors, lightMode)
	case "complementary":
		return GenerateComplementaryPalette(dominantColors, lightMode)
	case "triadic":
		return GenerateTriadicPalette(dominantColors, lightMode)
	case "split-complementary":
		return GenerateSplitComplementaryPalette(dominantColors, lightMode)
	case "tetradic":
		return GenerateTetradicPalette(dominantColors, lightMode)
	case "fire":
		return GenerateFirePalette(dominantColors, lightMode)
	case "ocean":
		return GenerateOceanPalette(dominantColors, lightMode)
	case "forest":
		return GenerateForestPalette(dominantColors, lightMode)
	case "earthtone":
		return GenerateEarthtonePalette(dominantColors, lightMode)
	case "neon":
		return GenerateNeonPalette(dominantColors, lightMode)
	case "sunset":
		return GenerateSunsetPalette(dominantColors, lightMode)
	case "vaporwave":
		return GenerateVaporwavePalette(dominantColors, lightMode)
	case "midnight":
		return GenerateMidnightPalette(dominantColors, lightMode)
	case "aurora":
		return GenerateAuroraPalette(dominantColors, lightMode)
	case "high-contrast":
		return GenerateHighContrastPalette(dominantColors, lightMode)
	case "duotone":
		return GenerateDuotonePalette(dominantColors, lightMode)
	default:
		if isMonochromeWeighted(dominantColors, weights) {
			return GenerateMonochromePalette(dominantColors, lightMode)
		}
		return GenerateChromaticPalette(dominantColors, weights, lightMode)
	}
}
