package omarchy_test

import (
	"testing"

	"aether/internal/omarchy"
)

func TestSlugifyThemeName(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"Cust - Mytheme", "cust-mytheme"},
		{"My Theme", "my-theme"},
		{"  spaces  ", "spaces"},
		{"Tokyo Night", "tokyo-night"},
		{"theme/with\\slash", "theme-with-slash"},
		{"---a---", "a"},
		{"under_score", "under_score"},
		{"!!!", ""},
		{"", ""},
		{"GRUVBOX", "gruvbox"},
		{"name.with.dots", "name-with-dots"},
		{"a b c d", "a-b-c-d"},
	}
	for _, tt := range tests {
		got := omarchy.SlugifyThemeName(tt.in)
		if got != tt.want {
			t.Errorf("SlugifyThemeName(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
