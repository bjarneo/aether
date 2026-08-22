package extraction

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadAndSamplePixelsWebP(t *testing.T) {
	const fixture = "UklGRjYAAABXRUJQVlA4ICoAAACwAQCdASoEAAQAAgA0JaACdLoABGaAAP7udn/3BmfV2OH9zcW5+hQAAAA="

	data, err := base64.StdEncoding.DecodeString(fixture)
	if err != nil {
		t.Fatalf("decode WebP fixture: %v", err)
	}

	path := filepath.Join(t.TempDir(), "fixture.webp")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("write WebP fixture: %v", err)
	}

	pixels, err := LoadAndSamplePixels(path)
	if err != nil {
		t.Fatalf("LoadAndSamplePixels() error = %v", err)
	}
	if len(pixels) == 0 {
		t.Fatal("LoadAndSamplePixels() returned no pixels")
	}
}
