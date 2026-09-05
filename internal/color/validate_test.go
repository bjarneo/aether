package color

import "testing"

func TestIsHexColor(t *testing.T) {
	cases := map[string]bool{
		"#fff":       true,
		"#ffffff":    true,
		"#ffffffff":  true,
		"#FFFF":      true,
		"#ggg":       false,
		"#fffffff":   false,
		"ffffff":     false,
		"":           false,
	}
	for in, want := range cases {
		if got := IsHexColor(in); got != want {
			t.Fatalf("IsHexColor(%q)=%v want %v", in, got, want)
		}
	}
}
