package blueprint

import (
	"fmt"

	"aether/internal/color"
)

func validateBlueprint(bp *Blueprint) error {
	if bp == nil {
		return fmt.Errorf("blueprint is empty")
	}
	if len(bp.Palette.Colors) < 16 {
		return fmt.Errorf("palette has %d colors; want at least 16", len(bp.Palette.Colors))
	}
	for i, value := range bp.Palette.Colors {
		if !color.IsHexColor(value) {
			return fmt.Errorf("palette color %d is not a hex color", i)
		}
	}
	for key, value := range bp.Palette.ExtendedColors {
		if value != "" && !color.IsHexColor(value) {
			return fmt.Errorf("extended color %q is not a hex color", key)
		}
	}
	for app, overrides := range bp.AppOverrides {
		for key, value := range overrides {
			if value != "" && !color.IsHexColor(value) {
				return fmt.Errorf("%s override %q is not a hex color", app, key)
			}
		}
	}
	for _, index := range bp.Palette.LockedColors {
		if index < 0 || index >= 16 {
			return fmt.Errorf("locked color index %d is out of range", index)
		}
	}
	return nil
}
