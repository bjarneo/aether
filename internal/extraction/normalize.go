package extraction

import "aether/internal/color"

// NormalizeBrightness ensures every ANSI color (slots 1-6) meets WCAG AA contrast
// against the background, boosting lightness in OKLCH where needed. It does NOT
// flatten lightness toward an average — preserving natural brightness hierarchy
// (yellow brighter than blue, etc.) is intentional.
func NormalizeBrightness(palette [16]string) [16]string {
	for i := 1; i <= 6; i++ {
		if color.ContrastRatio(palette[0], palette[i]) < MinContrastRatio {
			palette[i] = boostContrastAgainstBg(palette[i], palette[0], MinContrastRatio)
			palette[i+8] = GenerateBrightVersion(palette[i])
		}
	}
	return palette
}
