package icontheme

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestPreviewRasterizesBoundedPNGAndXPMWithInheritance(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	child := writeThemeIndex(t, root, "Child", `[Icon Theme]
Name=Child
Inherits=Parent
Directories=16x16/places,64x64/places,64x64/apps

[16x16/places]
Size=16
Context=Places
Type=Fixed

[64x64/places]
Size=64
Context=Places
Type=Fixed

[64x64/apps]
Size=64
Context=Applications
Type=Fixed
`)
	parent := writeThemeIndex(t, root, "Parent", `[Icon Theme]
Name=Parent
Directories=64x64/apps

[64x64/apps]
Size=64
Context=Applications
Type=Fixed
`)
	writeSolidPNG(t, filepath.Join(child, "16x16/places/folder.png"), 16, color.RGBA{R: 255, A: 255})
	writeSolidPNG(t, filepath.Join(child, "64x64/places/folder.png"), 64, color.RGBA{B: 255, A: 255})
	writeXPM(t, filepath.Join(child, "64x64/apps/web-browser.xpm"))
	writeSolidPNG(t, filepath.Join(parent, "64x64/apps/utilities-terminal.png"), 64, color.RGBA{G: 255, A: 255})

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	if _, err := catalog.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	preview, err := catalog.Preview(context.Background(), "Child")
	if err != nil {
		t.Fatal(err)
	}
	if preview.ThemeID != "Child" {
		t.Errorf("ThemeID = %q, want Child", preview.ThemeID)
	}
	if len(preview.Samples) != 3 {
		t.Fatalf("sample count = %d, want 3: %#v", len(preview.Samples), preview.Samples)
	}
	wantKinds := []string{"folder", "utility", "application"}
	for i, sample := range preview.Samples {
		if sample.Kind != wantKinds[i] {
			t.Errorf("sample %d kind = %q, want %q", i, sample.Kind, wantKinds[i])
		}
		decoded := decodePreviewPNG(t, sample.PNGData)
		if decoded.Bounds().Dx() > PreviewSize || decoded.Bounds().Dy() > PreviewSize {
			t.Errorf("sample %d dimensions = %v, exceed %d", i, decoded.Bounds(), PreviewSize)
		}
	}

	// The 64px folder is closest to the preview target, so blue must win over
	// the red 16px candidate.
	folder := decodePreviewPNG(t, preview.Samples[0].PNGData)
	r, g, b, _ := folder.At(folder.Bounds().Dx()/2, folder.Bounds().Dy()/2).RGBA()
	if b <= r || b <= g {
		t.Errorf("folder center RGB16 = (%d,%d,%d), want the blue 64px candidate", r, g, b)
	}

	data, err := json.Marshal(preview)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{root, ".svg", ".xpm", "file://"} {
		if bytes.Contains(data, []byte(forbidden)) {
			t.Errorf("public preview JSON contains forbidden source detail %q: %s", forbidden, data)
		}
	}
}

func TestPreviewRejectsSVGMarkupAndEscapingSymlink(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	outside := t.TempDir()
	theme := writeThemeIndex(t, root, "SVGOnly", `[Icon Theme]
Name=SVG Only
Directories=64x64/apps

[64x64/apps]
Size=64
Context=Applications
Type=Fixed
`)
	apps := filepath.Join(theme, "64x64/apps")
	if err := os.MkdirAll(apps, 0o755); err != nil {
		t.Fatal(err)
	}
	malicious := `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://example.invalid/')"><image href="file:///etc/passwd"/></svg>`
	if err := os.WriteFile(filepath.Join(apps, "web-browser.svg"), []byte(malicious), 0o600); err != nil {
		t.Fatal(err)
	}
	escaping := filepath.Join(outside, "utilities-terminal.png")
	writeSolidPNG(t, escaping, 16, color.RGBA{R: 255, A: 255})
	if err := os.Symlink(escaping, filepath.Join(apps, "utilities-terminal.png")); err != nil {
		t.Fatal(err)
	}

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	if _, err := catalog.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	preview, err := catalog.Preview(context.Background(), "SVGOnly")
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Samples) != 0 {
		t.Errorf("unsafe SVG/symlink produced samples: %#v", preview.Samples)
	}
	data, _ := json.Marshal(preview)
	if bytes.Contains(data, []byte("svg")) || bytes.Contains(data, []byte("/etc/passwd")) {
		t.Errorf("preview leaked SVG content: %s", data)
	}
}

func TestPreviewRejectsUnsafeOrMissingThemeID(t *testing.T) {
	t.Parallel()

	catalog := NewCatalogWithRoots([]Root{{Path: t.TempDir(), Origin: OriginUser}})
	if _, err := catalog.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"../escape", "Missing"} {
		if _, err := catalog.Preview(context.Background(), id); err == nil {
			t.Errorf("Preview(%q) error = nil, want rejection", id)
		}
	}
}

func TestPreviewCacheIsClearedByRefresh(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	theme := writeThemeIndex(t, root, "Mutable", `[Icon Theme]
Name=Mutable
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	iconPath := filepath.Join(theme, "64x64/places/folder.png")
	writeSolidPNG(t, iconPath, 64, color.RGBA{R: 255, A: 255})
	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	first, err := catalog.Preview(context.Background(), "Mutable")
	if err != nil {
		t.Fatal(err)
	}
	writeSolidPNG(t, iconPath, 64, color.RGBA{B: 255, A: 255})
	cached, err := catalog.Preview(context.Background(), "Mutable")
	if err != nil {
		t.Fatal(err)
	}
	if cached.Samples[0].PNGData != first.Samples[0].PNGData {
		t.Fatal("Preview cache changed without Refresh")
	}
	if _, err := catalog.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	refreshed, err := catalog.Preview(context.Background(), "Mutable")
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.Samples[0].PNGData == first.Samples[0].PNGData {
		t.Fatal("Refresh did not clear the preview cache")
	}
}

func TestConcurrentListRefreshAndPreview(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	theme := writeThemeIndex(t, root, "Concurrent", `[Icon Theme]
Name=Concurrent
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	writeSolidPNG(t, filepath.Join(theme, "64x64/places/folder.png"), 64, color.RGBA{G: 255, A: 255})
	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	if _, err := catalog.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errors := make(chan error, 30)
	for i := 0; i < 10; i++ {
		wg.Add(3)
		go func() {
			defer wg.Done()
			_, err := catalog.List(context.Background())
			errors <- err
		}()
		go func() {
			defer wg.Done()
			_, err := catalog.Refresh(context.Background())
			errors <- err
		}()
		go func() {
			defer wg.Done()
			_, err := catalog.Preview(context.Background(), "Concurrent")
			errors <- err
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Errorf("concurrent catalog call: %v", err)
		}
	}
}

func writeSolidPNG(t *testing.T, path string, size int, c color.Color) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			img.Set(x, y, c)
		}
	}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, img); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func writeXPM(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	content := `/* XPM */
static char * icon[] = {
"2 2 2 1",
". c #ff00ff",
"  c None",
". ",
" ."};
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func decodePreviewPNG(t *testing.T, dataURL string) image.Image {
	t.Helper()
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(dataURL, prefix) {
		t.Fatalf("preview URL does not have PNG data prefix: %.40q", dataURL)
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(dataURL, prefix))
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode returned PNG: %v", err)
	}
	return img
}
