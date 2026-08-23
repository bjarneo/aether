package wallpaper

import (
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/color"
	"image/png"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateRemoteURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{name: "public HTTPS", url: "https://8.8.8.8/theme.json"},
		{name: "HTTP", url: "http://example.com/theme.json", wantErr: true},
		{name: "credentials", url: "https://user:pass@example.com/theme.json", wantErr: true},
		{name: "loopback", url: "https://127.0.0.1/theme.json", wantErr: true},
		{name: "private IPv4", url: "https://192.168.1.1/theme.json", wantErr: true},
		{name: "link local", url: "https://169.254.169.254/latest/meta-data", wantErr: true},
		{name: "private IPv6", url: "https://[fd00::1]/theme.json", wantErr: true},
		{name: "localhost name", url: "https://localhost/theme.json", wantErr: true},
		{name: "mDNS name", url: "https://host.local/theme.json", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateRemoteURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateRemoteURL(%q) error = %v; wantErr %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestIsPublicAddressRejectsSpecialRanges(t *testing.T) {
	for _, raw := range []string{"100.64.0.1", "198.18.0.1", "192.0.2.1", "2001:db8::1"} {
		if isPublicAddress(netip.MustParseAddr(raw)) {
			t.Errorf("isPublicAddress(%q) = true; want false", raw)
		}
	}
	if !isPublicAddress(netip.MustParseAddr("8.8.8.8")) {
		t.Error("public address was rejected")
	}
}

func TestDownloadToCacheRejectsOversizedCachedFile(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	rawURL := "https://8.8.8.8/theme.json"
	dir, err := webImportsDir()
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(rawURL))
	name := hex.EncodeToString(sum[:8]) + extFromURL(rawURL)
	if err := os.WriteFile(filepath.Join(dir, name), []byte("too large"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err = DownloadToCache(rawURL, 4)
	if err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("DownloadToCache() error = %v; want size-limit error", err)
	}
}

func TestValidateImageFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wallpaper.png")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.White)
	if err := png.Encode(f, img); err != nil {
		f.Close()
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	if err := ValidateImageFile(path); err != nil {
		t.Fatalf("ValidateImageFile() error = %v", err)
	}

	invalid := filepath.Join(t.TempDir(), "not-an-image.png")
	if err := os.WriteFile(invalid, []byte("not an image"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := ValidateImageFile(invalid); err == nil {
		t.Fatal("ValidateImageFile() accepted invalid image data")
	}
}
