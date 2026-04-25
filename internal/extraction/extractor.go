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

	dominantColors, err := ExtractDominantColors(imagePath, DominantColorsToExtract)
	if err != nil {
		return [16]string{}, fmt.Errorf("color extraction failed: %w", err)
	}
	if len(dominantColors) < 8 {
		return [16]string{}, fmt.Errorf("not enough colors extracted from image")
	}

	palette := NormalizeBrightness(GeneratePaletteByMode(dominantColors, lightMode, mode))

	if cacheKey != "" {
		SavePaletteToCache(cacheKey, palette)
	}
	return palette, nil
}

// GeneratePaletteByMode dispatches to the palette generator for a given mode.
// In "normal" mode, auto-detects between monochrome and chromatic generators.
func GeneratePaletteByMode(dominantColors []string, lightMode bool, mode string) [16]string {
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
		if IsMonochromeImage(dominantColors) {
			return GenerateMonochromePalette(dominantColors, lightMode)
		}
		return GenerateChromaticPalette(dominantColors, lightMode)
	}
}
