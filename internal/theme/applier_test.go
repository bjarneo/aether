package theme

import "testing"

func TestNormalizeWallpaperBackend(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty defaults to auto", in: "", want: WallpaperBackendAuto},
		{name: "auto", in: "auto", want: WallpaperBackendAuto},
		{name: "omarchy", in: "omarchy", want: WallpaperBackendOmarchy},
		{name: "awww", in: "awww", want: WallpaperBackendAwww},
		{name: "none", in: "none", want: WallpaperBackendNone},
		{name: "case and space", in: " AWWW ", want: WallpaperBackendAwww},
		{name: "unknown defaults to auto", in: "custom", want: WallpaperBackendAuto},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeWallpaperBackend(tt.in); got != tt.want {
				t.Fatalf("normalizeWallpaperBackend(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestSelectWallpaperBackend(t *testing.T) {
	tests := []struct {
		name         string
		requested    string
		availability wallpaperBackendAvailability
		want         string
	}{
		{
			name:      "auto prefers omarchy",
			requested: WallpaperBackendAuto,
			availability: wallpaperBackendAvailability{
				Omarchy: true,
				Awww:    true,
			},
			want: WallpaperBackendOmarchy,
		},
		{
			name:      "auto falls back to awww",
			requested: WallpaperBackendAuto,
			availability: wallpaperBackendAvailability{
				Awww: true,
			},
			want: WallpaperBackendAwww,
		},
		{
			name:      "auto skips when unavailable",
			requested: WallpaperBackendAuto,
			want:      WallpaperBackendNone,
		},
		{
			name:      "explicit awww wins",
			requested: WallpaperBackendAwww,
			availability: wallpaperBackendAvailability{
				Omarchy: true,
			},
			want: WallpaperBackendAwww,
		},
		{
			name:      "explicit omarchy wins",
			requested: WallpaperBackendOmarchy,
			availability: wallpaperBackendAvailability{
				Awww: true,
			},
			want: WallpaperBackendOmarchy,
		},
		{
			name:      "explicit none wins",
			requested: WallpaperBackendNone,
			availability: wallpaperBackendAvailability{
				Omarchy: true,
				Awww:    true,
			},
			want: WallpaperBackendNone,
		},
		{
			name:      "unknown uses auto",
			requested: "other",
			availability: wallpaperBackendAvailability{
				Awww: true,
			},
			want: WallpaperBackendAwww,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := selectWallpaperBackend(tt.requested, tt.availability); got != tt.want {
				t.Fatalf("selectWallpaperBackend(%q, %+v) = %q, want %q", tt.requested, tt.availability, got, tt.want)
			}
		})
	}
}
