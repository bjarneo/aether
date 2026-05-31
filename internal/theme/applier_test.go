package theme_test

import (
	"testing"

	"aether/internal/theme"
)

func TestNormalizeWallpaperBackend(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty defaults to auto", in: "", want: theme.WallpaperBackendAuto},
		{name: "auto", in: "auto", want: theme.WallpaperBackendAuto},
		{name: "omarchy", in: "omarchy", want: theme.WallpaperBackendOmarchy},
		{name: "awww", in: "awww", want: theme.WallpaperBackendAwww},
		{name: "swaybg", in: "swaybg", want: theme.WallpaperBackendSwaybg},
		{name: "none", in: "none", want: theme.WallpaperBackendNone},
		{name: "case and space", in: " AWWW ", want: theme.WallpaperBackendAwww},
		{name: "unknown defaults to auto", in: "custom", want: theme.WallpaperBackendAuto},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := theme.NormalizeWallpaperBackend(tt.in); got != tt.want {
				t.Fatalf("normalizeWallpaperBackend(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestSelectWallpaperBackend(t *testing.T) {
	tests := []struct {
		name         string
		requested    string
		availability theme.WallpaperBackendAvailability
		want         string
	}{
		{
			name:      "auto prefers omarchy",
			requested: theme.WallpaperBackendAuto,
			availability: theme.WallpaperBackendAvailability{
				Omarchy: true,
				Awww:    true,
			},
			want: theme.WallpaperBackendOmarchy,
		},
		{
			name:      "auto falls back to awww",
			requested: theme.WallpaperBackendAuto,
			availability: theme.WallpaperBackendAvailability{
				Awww: true,
			},
			want: theme.WallpaperBackendAwww,
		},
		{
			name:      "auto falls back to swaybg",
			requested: theme.WallpaperBackendAuto,
			availability: theme.WallpaperBackendAvailability{
				Swaybg: true,
			},
			want: theme.WallpaperBackendSwaybg,
		},
		{
			name:      "auto skips when unavailable",
			requested: theme.WallpaperBackendAuto,
			want:      theme.WallpaperBackendNone,
		},
		{
			name:      "explicit awww wins",
			requested: theme.WallpaperBackendAwww,
			availability: theme.WallpaperBackendAvailability{
				Omarchy: true,
			},
			want: theme.WallpaperBackendAwww,
		},
		{
			name:      "explicit swaybg wins",
			requested: theme.WallpaperBackendSwaybg,
			availability: theme.WallpaperBackendAvailability{
				Omarchy: true,
				Awww:    true,
			},
			want: theme.WallpaperBackendSwaybg,
		},
		{
			name:      "explicit omarchy wins",
			requested: theme.WallpaperBackendOmarchy,
			availability: theme.WallpaperBackendAvailability{
				Awww: true,
			},
			want: theme.WallpaperBackendOmarchy,
		},
		{
			name:      "explicit none wins",
			requested: theme.WallpaperBackendNone,
			availability: theme.WallpaperBackendAvailability{
				Omarchy: true,
				Awww:    true,
			},
			want: theme.WallpaperBackendNone,
		},
		{
			name:      "unknown uses auto",
			requested: "other",
			availability: theme.WallpaperBackendAvailability{
				Awww: true,
			},
			want: theme.WallpaperBackendAwww,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := theme.SelectWallpaperBackend(tt.requested, tt.availability); got != tt.want {
				t.Fatalf("selectWallpaperBackend(%q, %+v) = %q, want %q", tt.requested, tt.availability, got, tt.want)
			}
		})
	}
}
