package template

import (
	"fmt"
	"regexp"
	"strings"

	"aether/internal/color"
)

// ReplaceVariable replaces all variants of a variable in content:
//   - {key}          -> value
//   - {key.strip}    -> value without '#' prefix
//   - {key.rgb}      -> "r,g,b" decimal
//   - {key.rgba}     -> "rgba(r, g, b, 1.0)"
//   - {key.rgba:0.5} -> "rgba(r, g, b, 0.5)"
//   - {key.yaru}     -> Yaru icon theme name based on hue
func ReplaceVariable(content, key, value string) string {
	// Replace {key}
	content = strings.ReplaceAll(content, "{"+key+"}", value)

	// Replace {key.strip} (removes '#' from hex colors)
	stripped := strings.Replace(value, "#", "", 1)
	content = strings.ReplaceAll(content, "{"+key+".strip}", stripped)

	// Replace {key.rgb} (converts hex to decimal RGB: r,g,b)
	if strings.HasPrefix(value, "#") {
		rgbValue := color.HexToRGBString(value)
		content = strings.ReplaceAll(content, "{"+key+".rgb}", rgbValue)
	} else {
		content = strings.ReplaceAll(content, "{"+key+".rgb}", value)
	}

	// Replace {key.rgba} and {key.rgba:N} (converts hex to rgba format)
	rgbaPattern := regexp.MustCompile(fmt.Sprintf(`\{%s\.rgba(?::(\d*\.?\d+))?\}`, regexp.QuoteMeta(key)))
	if strings.HasPrefix(value, "#") {
		content = rgbaPattern.ReplaceAllStringFunc(content, func(match string) string {
			submatches := rgbaPattern.FindStringSubmatch(match)
			alpha := 1.0
			if len(submatches) > 1 && submatches[1] != "" {
				fmt.Sscanf(submatches[1], "%f", &alpha)
			}
			return color.HexToRGBA(value, alpha)
		})
	} else {
		content = rgbaPattern.ReplaceAllString(content, value)
	}

	// Replace {key.yaru} (maps color to Yaru icon theme variant)
	if strings.HasPrefix(value, "#") {
		yaruTheme := color.HexToYaruTheme(value)
		content = strings.ReplaceAll(content, "{"+key+".yaru}", yaruTheme)
	} else {
		content = strings.ReplaceAll(content, "{"+key+".yaru}", value)
	}

	return content
}

// ProcessTemplate replaces all variables in template content and returns the
// processed result. Each variable is substituted using ReplaceVariable which
// handles {key}, {key.strip}, {key.rgb}, {key.rgba}, and {key.yaru} variants.
func ProcessTemplate(templateContent string, variables map[string]string) string {
	result := templateContent
	for key, value := range variables {
		result = ReplaceVariable(result, key, value)
	}
	return result
}
