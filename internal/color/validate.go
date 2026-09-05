package color

// IsHexColor reports whether value is a safe 3-, 4-, 6-, or 8-digit hex color.
// Eight-digit form is #RRGGBBAA (used by templates such as aether.zed.json).
func IsHexColor(value string) bool {
	switch len(value) {
	case 4, 5, 7, 9:
	default:
		return false
	}
	if value[0] != '#' {
		return false
	}
	for i := 1; i < len(value); i++ {
		c := value[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
