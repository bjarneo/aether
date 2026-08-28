package icontheme

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image/color"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
)

func TestCatalogSkipsMalformedOversizedUnreadableAndSpecialEntries(t *testing.T) {
	root := t.TempDir()
	writeThemeIndex(t, root, "Localized", "[Icon Theme]\nName=Grüße 世界\n")
	writeThemeIndex(t, root, "Malformed", "[Icon Theme\nName=Malformed\n")
	oversized := writeThemeIndex(t, root, "Oversized", "[Icon Theme]\nName=Oversized\n")
	if err := os.WriteFile(filepath.Join(oversized, "index.theme"), bytes.Repeat([]byte{'x'}, int(MaxMetadataBytes)+1), 0o600); err != nil {
		t.Fatal(err)
	}
	unreadable := writeThemeIndex(t, root, "Unreadable", "[Icon Theme]\nName=Unreadable\n")
	unreadableIndex := filepath.Join(unreadable, "index.theme")
	if err := os.Chmod(unreadableIndex, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(unreadableIndex, 0o600) })
	if err := syscall.Mkfifo(filepath.Join(root, "NotATheme"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "CycleB"), filepath.Join(root, "CycleA")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "CycleA"), filepath.Join(root, "CycleB")); err != nil {
		t.Fatal(err)
	}

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	items, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "Localized" || items[0].Name != "Grüße 世界" {
		t.Fatalf("Refresh() = %#v, want only localized valid theme", items)
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encoded, []byte(root)) || bytes.Contains(bytes.ToLower(encoded), []byte("path")) {
		t.Fatalf("catalog DTO leaked a host path or path field: %s", encoded)
	}
}

func TestCatalogLargeCollectionStopsAtLogicalThemeBound(t *testing.T) {
	root := t.TempDir()
	for i := 0; i < MaxThemes+1; i++ {
		id := fmt.Sprintf("Theme-%04d", i)
		writeThemeIndex(t, root, id, "[Icon Theme]\nName="+id+"\n")
	}
	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	items, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != MaxThemes {
		t.Fatalf("Refresh() returned %d themes, want bound %d", len(items), MaxThemes)
	}
	if items[0].ID != "Theme-0000" || items[len(items)-1].ID != "Theme-1023" {
		t.Fatalf("bounded catalog is not deterministic: first=%q last=%q", items[0].ID, items[len(items)-1].ID)
	}
}

func TestPreviewInheritanceOrderMissingParentAndCycle(t *testing.T) {
	root := t.TempDir()
	writeThemeIndex(t, root, "Root", `[Icon Theme]
Name=Root
Inherits=Missing,Cycle,First,Second
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	writeThemeIndex(t, root, "Cycle", "[Icon Theme]\nName=Cycle\nInherits=Root\n")
	first := writeThemeIndex(t, root, "First", `[Icon Theme]
Name=First
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	second := writeThemeIndex(t, root, "Second", `[Icon Theme]
Name=Second
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	writeSolidPNG(t, filepath.Join(first, "64x64/places/folder.png"), 8, color.RGBA{G: 255, A: 255})
	writeSolidPNG(t, filepath.Join(second, "64x64/places/folder.png"), 8, color.RGBA{B: 255, A: 255})

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	preview, err := catalog.Preview(context.Background(), "Root")
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Samples) != 1 {
		t.Fatalf("Preview() samples = %#v, want inherited folder", preview.Samples)
	}
	img := decodePreviewPNG(t, preview.Samples[0].PNGData)
	r, g, b, _ := img.At(PreviewSize/2, PreviewSize/2).RGBA()
	if g <= r || g <= b {
		t.Fatalf("inheritance order chose RGB16 (%d,%d,%d), want First/green", r, g, b)
	}
}

func TestPreviewStopsAtInheritanceDepthAndVisitedBounds(t *testing.T) {
	t.Run("depth", func(t *testing.T) {
		root := t.TempDir()
		for i := 0; i <= MaxInheritanceDepth+1; i++ {
			id := fmt.Sprintf("Depth-%02d", i)
			inherits := ""
			if i <= MaxInheritanceDepth {
				inherits = fmt.Sprintf("Inherits=Depth-%02d\n", i+1)
			}
			dir := writeThemeIndex(t, root, id, "[Icon Theme]\nName="+id+"\n"+inherits+"Directories=64x64/places\n[64x64/places]\nSize=64\nContext=Places\n")
			if i == MaxInheritanceDepth+1 {
				writeSolidPNG(t, filepath.Join(dir, "64x64/places/folder.png"), 1, color.RGBA{R: 255, A: 255})
			}
		}
		catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
		preview, err := catalog.Preview(context.Background(), "Depth-00")
		if err != nil {
			t.Fatal(err)
		}
		if len(preview.Samples) != 0 {
			t.Fatalf("depth-bounded preview returned samples: %#v", preview.Samples)
		}
	})

	t.Run("visited", func(t *testing.T) {
		root := t.TempDir()
		parents := make([]string, 0, MaxVisitedInheritedThemes+1)
		for i := 0; i <= MaxVisitedInheritedThemes; i++ {
			id := fmt.Sprintf("Parent-%03d", i)
			parents = append(parents, id)
			dir := writeThemeIndex(t, root, id, "[Icon Theme]\nName="+id+"\nDirectories=64x64/places\n[64x64/places]\nSize=64\nContext=Places\n")
			if i == MaxVisitedInheritedThemes {
				writeSolidPNG(t, filepath.Join(dir, "64x64/places/folder.png"), 1, color.RGBA{R: 255, A: 255})
			}
		}
		writeThemeIndex(t, root, "VisitedRoot", "[Icon Theme]\nName=Visited Root\nInherits="+strings.Join(parents, ",")+"\n")
		catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
		preview, err := catalog.Preview(context.Background(), "VisitedRoot")
		if err != nil {
			t.Fatal(err)
		}
		if len(preview.Samples) != 0 {
			t.Fatalf("visited-bounded preview returned samples: %#v", preview.Samples)
		}
	})
}

func TestPreviewContainedFileSymlinkSpecialFileAndRasterDimensionBounds(t *testing.T) {
	user := t.TempDir()
	system := t.TempDir()
	shared := filepath.Join(system, "shared-folder.png")
	writeSolidPNG(t, shared, 8, color.RGBA{G: 255, A: 255})
	contained := writeThemeIndex(t, user, "ContainedFile", `[Icon Theme]
Name=Contained File
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
`)
	containedDir := filepath.Join(contained, "64x64/places")
	if err := os.MkdirAll(containedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(shared, filepath.Join(containedDir, "folder.png")); err != nil {
		t.Fatal(err)
	}

	special := writeThemeIndex(t, user, "SpecialFile", `[Icon Theme]
Name=Special File
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
`)
	specialDir := filepath.Join(special, "64x64/places")
	if err := os.MkdirAll(specialDir, 0o755); err != nil {
		t.Fatal(err)
	}
	fifo := filepath.Join(system, "shared.fifo")
	if err := syscall.Mkfifo(fifo, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(fifo, filepath.Join(specialDir, "folder.png")); err != nil {
		t.Fatal(err)
	}

	oversized := writeThemeIndex(t, user, "OversizedRaster", `[Icon Theme]
Name=Oversized Raster
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
`)
	writeSolidPNG(t, filepath.Join(oversized, "64x64/places/folder.png"), MaxRasterDimension+1, color.RGBA{R: 255, A: 255})

	catalog := NewCatalogWithRoots([]Root{
		{Path: user, Origin: OriginUser},
		{Path: system, Origin: OriginSystem},
	})
	preview, err := catalog.Preview(context.Background(), "ContainedFile")
	if err != nil || len(preview.Samples) != 1 {
		t.Fatalf("contained file symlink preview = %#v, %v", preview, err)
	}
	for _, id := range []string{"SpecialFile", "OversizedRaster"} {
		preview, err := catalog.Preview(context.Background(), id)
		if err != nil {
			t.Fatal(err)
		}
		if len(preview.Samples) != 0 {
			t.Fatalf("Preview(%q) accepted unsafe source: %#v", id, preview.Samples)
		}
	}
}

func TestPreviewCacheEvictionIsBounded(t *testing.T) {
	root := t.TempDir()
	for i := 0; i <= MaxPreviewCacheEntries; i++ {
		id := fmt.Sprintf("Cached-%03d", i)
		dir := writeThemeIndex(t, root, id, "[Icon Theme]\nName="+id+"\nDirectories=64x64/places\n[64x64/places]\nSize=64\nContext=Places\n")
		writeSolidPNG(t, filepath.Join(dir, "64x64/places/folder.png"), 1, color.RGBA{G: 255, A: 255})
	}
	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	for i := 0; i <= MaxPreviewCacheEntries; i++ {
		if _, err := catalog.Preview(context.Background(), fmt.Sprintf("Cached-%03d", i)); err != nil {
			t.Fatal(err)
		}
	}
	catalog.previewMu.Lock()
	defer catalog.previewMu.Unlock()
	if len(catalog.previewCache) != MaxPreviewCacheEntries || len(catalog.previewOrder) != MaxPreviewCacheEntries {
		t.Fatalf("preview cache sizes = %d/%d, want %d", len(catalog.previewCache), len(catalog.previewOrder), MaxPreviewCacheEntries)
	}
	firstKey := fmt.Sprintf("%d:Cached-000", catalog.generation)
	if _, ok := catalog.previewCache[firstKey]; ok {
		t.Fatal("oldest preview cache entry was not evicted")
	}
}

func TestPreviewRaceReplacedSymlinkNeverEscapesApprovedRoots(t *testing.T) {
	approved := t.TempDir()
	outside := t.TempDir()
	theme := writeThemeIndex(t, approved, "Raced", `[Icon Theme]
Name=Raced
Directories=64x64/places
[64x64/places]
Size=64
Context=Places
`)
	insideIcon := filepath.Join(approved, "inside.png")
	outsideIcon := filepath.Join(outside, "outside.png")
	writeSolidPNG(t, insideIcon, 4, color.RGBA{G: 255, A: 255})
	writeSolidPNG(t, outsideIcon, 4, color.RGBA{R: 255, A: 255})
	link := filepath.Join(theme, "64x64/places/folder.png")
	if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(insideIcon, link); err != nil {
		t.Fatal(err)
	}

	catalog := NewCatalogWithRoots([]Root{{Path: approved, Origin: OriginUser}})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			_ = os.Remove(link)
			target := insideIcon
			if i%2 == 1 {
				target = outsideIcon
			}
			_ = os.Symlink(target, link)
		}
	}()
	for i := 0; i < 100; i++ {
		if _, err := catalog.Refresh(context.Background()); err != nil {
			t.Fatal(err)
		}
		preview, err := catalog.Preview(context.Background(), "Raced")
		if err != nil {
			if strings.Contains(err.Error(), outside) {
				t.Fatalf("frontend-facing error leaked outside path: %v", err)
			}
			continue
		}
		if len(preview.Samples) == 0 {
			continue
		}
		img := decodePreviewPNG(t, preview.Samples[0].PNGData)
		r, g, _, _ := img.At(PreviewSize/2, PreviewSize/2).RGBA()
		if r > g {
			t.Fatal("race-replaced escaping symlink produced outside raster data")
		}
	}
	wg.Wait()
}
