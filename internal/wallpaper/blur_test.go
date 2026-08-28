package wallpaper

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeTestPNG writes a PNG with a sharp two-half pattern (left black, right
// white) — a worst case for blur, since a heavy blur must smear it gray.
func writeTestPNG(t *testing.T, dir, name string, w, h int) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := color.RGBA{B: 0xff, A: 0xff}
			if x < w/2 {
				c = color.RGBA{A: 0xff}
			}
			img.SetRGBA(x, y, c)
		}
	}
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create test image: %v", err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatalf("encode test image: %v", err)
	}
	return path
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return data
}

func TestCreateBlurredVariant(t *testing.T) {
	srcDir := t.TempDir()
	outDir := t.TempDir()
	src := writeTestPNG(t, srcDir, "wall.png", 200, 120)
	srcBytes := mustReadFile(t, src)

	got, err := CreateBlurredVariant(src, outDir)
	if err != nil {
		t.Fatalf("CreateBlurredVariant: %v", err)
	}

	if filepath.Dir(got) != outDir {
		t.Errorf("variant written outside destDir: %s", got)
	}
	if filepath.Ext(got) != ".jpg" {
		t.Errorf("variant should be .jpg, got %s", got)
	}

	data := mustReadFile(t, got)
	if len(data) == 0 {
		t.Fatal("variant file is empty")
	}
	if _, err := jpeg.Decode(bytes.NewReader(data)); err != nil {
		t.Fatalf("variant is not a decodable JPEG: %v", err)
	}

	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode variant: %v", err)
	}
	b := decoded.Bounds()
	if b.Dx() != 200 || b.Dy() != 120 {
		t.Errorf("variant dims = %dx%d, want 200x120", b.Dx(), b.Dy())
	}

	// A sharp black/white split must be smeared towards gray by a heavy blur.
	center := decoded.At(150, 60)
	r, g, bl, _ := center.RGBA()
	if r >= 65000 && g >= 65000 && bl >= 65000 {
		t.Errorf("right half still pure white at (150,60): blur had no effect")
	}

	// Source must be untouched.
	if !bytes.Equal(srcBytes, mustReadFile(t, src)) {
		t.Error("source file was modified")
	}
}

func TestCreateBlurredVariantCaches(t *testing.T) {
	srcDir := t.TempDir()
	outDir := t.TempDir()
	src := writeTestPNG(t, srcDir, "wall.png", 64, 64)

	first, err := CreateBlurredVariant(src, outDir)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	info, err := os.Stat(first)
	if err != nil {
		t.Fatalf("stat variant: %v", err)
	}

	second, err := CreateBlurredVariant(src, outDir)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if second != first {
		t.Errorf("cache miss: got %s, want %s", second, first)
	}
	again, err := os.Stat(first)
	if err != nil {
		t.Fatalf("re-stat variant: %v", err)
	}
	if !again.ModTime().Equal(info.ModTime()) {
		t.Error("cached variant was rewritten")
	}
}

func TestCreateBlurredVariantRegeneratedAfterEdit(t *testing.T) {
	srcDir := t.TempDir()
	outDir := t.TempDir()
	src := writeTestPNG(t, srcDir, "wall.png", 64, 64)

	first, err := CreateBlurredVariant(src, outDir)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}

	// Rewrite the source (editor flow) — mtime changes, so a new variant
	// must be generated instead of reusing the stale cache entry.
	future := time.Now().Add(2 * time.Hour)
	if err := os.Chtimes(src, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	second, err := CreateBlurredVariant(src, outDir)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if second == first {
		t.Error("edited source reused stale blurred variant")
	}
}

func TestCreateBlurredVariantErrors(t *testing.T) {
	outDir := t.TempDir()

	if _, err := CreateBlurredVariant(filepath.Join(outDir, "missing.png"), outDir); err == nil {
		t.Error("expected error for missing file")
	}

	txt := filepath.Join(outDir, "notes.txt")
	if err := os.WriteFile(txt, []byte("not an image"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateBlurredVariant(txt, outDir); err == nil {
		t.Error("expected error for non-image file")
	}
}
