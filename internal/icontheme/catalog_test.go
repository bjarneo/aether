package icontheme

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image/color"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestParseINIAcceptsExactLineBoundAndRejectsOneByteOver(t *testing.T) {
	t.Parallel()

	prefix := []byte("Name=")
	exactLine := append(append([]byte(nil), prefix...), bytes.Repeat([]byte{'x'}, MaxMetadataLineBytes-len(prefix))...)
	exact := append([]byte("[Icon Theme]\n"), exactLine...)
	exact = append(exact, '\n')
	sections, err := parseINI(exact)
	if err != nil {
		t.Fatalf("parseINI(exact %d-byte line): %v", MaxMetadataLineBytes, err)
	}
	if len(sections["Icon Theme"]["Name"]) != MaxMetadataLineBytes-len(prefix) {
		t.Fatal("parseINI truncated exact-boundary metadata")
	}

	over := append(append([]byte(nil), exactLine...), 'x')
	overData := append([]byte("[Icon Theme]\n"), over...)
	overData = append(overData, '\n')
	if _, err := parseINI(overData); err == nil {
		t.Fatalf("parseINI(%d-byte line) error = nil, want bound rejection", MaxMetadataLineBytes+1)
	}
}

func TestCatalogListCachesAndRefreshReplacesSnapshot(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	writeThemeIndex(t, root, "One", "[Icon Theme]\nName=One\n")
	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	first, err := catalog.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	writeThemeIndex(t, root, "Two", "[Icon Theme]\nName=Two\n")
	cached, err := catalog.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cached, first) {
		t.Errorf("cached List() = %#v, want unchanged %#v", cached, first)
	}
	refreshed, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(refreshed) != 2 {
		t.Errorf("Refresh() returned %d themes, want 2", len(refreshed))
	}
}

func TestCatalogRefreshHonorsCancellation(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	catalog := NewCatalogWithRoots([]Root{{Path: t.TempDir(), Origin: OriginUser}})
	if _, err := catalog.Refresh(ctx); !errors.Is(err, context.Canceled) {
		t.Errorf("Refresh(canceled) error = %v, want context.Canceled", err)
	}
}

func TestCatalogRefreshErrorsOnlyWhenEveryApprovedRootIsUnreadable(t *testing.T) {
	readable := t.TempDir()
	unreadable := t.TempDir()
	writeThemeIndex(t, readable, "Readable", "[Icon Theme]\nName=Readable\n")
	if err := os.Chmod(unreadable, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(unreadable, 0o700) })

	partial := NewCatalogWithRoots([]Root{
		{Path: unreadable, Origin: OriginUser},
		{Path: readable, Origin: OriginSystem},
	})
	items, err := partial.Refresh(context.Background())
	if err != nil {
		t.Fatalf("Refresh(partial roots) error = %v, want usable partial result", err)
	}
	if len(items) != 1 || items[0].ID != "Readable" {
		t.Fatalf("Refresh(partial roots) = %#v, want Readable", items)
	}

	unreliable := NewCatalogWithRoots([]Root{{Path: unreadable, Origin: OriginUser}})
	if _, err := unreliable.Refresh(context.Background()); err == nil {
		t.Fatal("Refresh(all unreadable roots) error = nil, want catalog error")
	}
}

func TestBuildRootsUsesXDGPrecedenceAndDeduplicates(t *testing.T) {
	t.Parallel()

	got := BuildRoots(
		"/home/tester",
		"",
		"/opt/share::relative:/usr/share:/opt/share",
	)
	want := []Root{
		{Path: "/home/tester/.local/share/icons", Origin: OriginUser},
		{Path: "/home/tester/.icons", Origin: OriginUser},
		{Path: "/opt/share/icons", Origin: OriginSystem},
		{Path: "/usr/share/icons", Origin: OriginSystem},
		{Path: "/usr/local/share/icons", Origin: OriginSystem},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("BuildRoots() = %#v, want %#v", got, want)
	}
}

func TestBuildRootsUsesExplicitDataHomeAndDefaultDataDirs(t *testing.T) {
	t.Parallel()

	got := BuildRoots("/home/tester", "/data/user", "")
	want := []Root{
		{Path: "/data/user/icons", Origin: OriginUser},
		{Path: "/home/tester/.icons", Origin: OriginUser},
		{Path: "/usr/local/share/icons", Origin: OriginSystem},
		{Path: "/usr/share/icons", Origin: OriginSystem},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("BuildRoots() = %#v, want %#v", got, want)
	}
}

func TestCatalogDiscoveryMetadataPrecedenceAndSort(t *testing.T) {
	t.Parallel()

	user := t.TempDir()
	system := t.TempDir()
	writeThemeIndex(t, user, "Papirus", `[Icon Theme]
Name=Papirus User
Inherits=Adwaita, ../unsafe, hicolor
Directories=48x48/apps
`)
	writeThemeIndex(t, system, "Papirus", `[Icon Theme]
Name=Papirus System
`)
	writeThemeIndex(t, system, "Adwaita", `[Icon Theme]
Name=Adwaita
Directories=48x48/apps
`)
	writeThemeIndex(t, user, "Hidden", `[Icon Theme]
Name=Hidden Theme
Hidden=TRUE
`)
	writeThemeIndex(t, user, "Fallback", `[Broken Group
Name=Broken
`)
	writeThemeIndex(t, system, "Fallback", `[Icon Theme]
Name=Fallback System
`)
	writeThemeIndex(t, user, "NoIndex", ``)
	if err := os.Mkdir(filepath.Join(user, "PlainDirectory"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(user, "NotADirectory"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	catalog := NewCatalogWithRoots([]Root{
		{Path: user, Origin: OriginUser},
		{Path: system, Origin: OriginSystem},
	})
	got, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := []ThemeSummary{
		{ID: "Adwaita", Name: "Adwaita", Origin: OriginSystem, HasPreview: true},
		{ID: "Fallback", Name: "Fallback System", Origin: OriginSystem},
		{
			ID:         "Papirus",
			Name:       "Papirus User",
			Inherits:   []string{"Adwaita", "hicolor"},
			Origin:     OriginUser,
			HasPreview: true,
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Refresh() = %#v, want %#v", got, want)
	}
}

func TestCatalogPreviewUsesLowerPrecedenceFragmentMetadata(t *testing.T) {
	t.Parallel()

	user := t.TempDir()
	system := t.TempDir()
	writeThemeIndex(t, user, "Split", "[Icon Theme]\nName=Split User\n")
	systemTheme := writeThemeIndex(t, system, "Split", `[Icon Theme]
Name=Split System
Directories=64x64/places

[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	writeSolidPNG(t, filepath.Join(systemTheme, "64x64/places/folder.png"), 64, color.RGBA{B: 255, A: 255})

	catalog := NewCatalogWithRoots([]Root{
		{Path: user, Origin: OriginUser},
		{Path: system, Origin: OriginSystem},
	})
	items, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Name != "Split User" || !items[0].HasPreview {
		t.Fatalf("split summary = %#v, want user metadata with preview", items)
	}
	preview, err := catalog.Preview(context.Background(), "Split")
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Samples) != 1 || preview.Samples[0].Kind != "folder" {
		t.Fatalf("split preview = %#v, want lower-fragment folder", preview)
	}
}

func TestCatalogInheritedThemeAdvertisesLazyPreview(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	writeThemeIndex(t, root, "Child", "[Icon Theme]\nName=Child\nInherits=Parent\n")
	parent := writeThemeIndex(t, root, "Parent", `[Icon Theme]
Name=Parent
Directories=64x64/places

[64x64/places]
Size=64
Context=Places
Type=Fixed
`)
	writeSolidPNG(t, filepath.Join(parent, "64x64/places/folder.png"), 64, color.RGBA{G: 255, A: 255})

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	items, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range items {
		if item.ID == "Child" && !item.HasPreview {
			t.Fatal("inherited theme does not advertise its available lazy preview")
		}
	}
}

func TestCatalogThemeLimitCountsValidThemes(t *testing.T) {
	root := t.TempDir()
	for i := 0; i < MaxThemes; i++ {
		id := fmt.Sprintf("Invalid-%04d", i)
		if err := os.Mkdir(filepath.Join(root, id), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	writeThemeIndex(t, root, "Valid-After-Invalid", "[Icon Theme]\nName=Valid\n")

	catalog := NewCatalogWithRoots([]Root{{Path: root, Origin: OriginUser}})
	items, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "Valid-After-Invalid" {
		t.Fatalf("Refresh() = %#v, want valid theme after invalid candidates", items)
	}
}

func TestCatalogAllowsContainedThemeSymlinkAndRejectsEscape(t *testing.T) {
	t.Parallel()

	user := t.TempDir()
	system := t.TempDir()
	outside := t.TempDir()
	writeThemeIndex(t, system, "ContainedTarget", `[Icon Theme]
Name=Contained
`)
	writeThemeIndex(t, outside, "OutsideTarget", `[Icon Theme]
Name=Outside
`)
	if err := os.Symlink(filepath.Join(system, "ContainedTarget"), filepath.Join(user, "Alias")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(outside, "OutsideTarget"), filepath.Join(user, "Escape")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(user, "missing"), filepath.Join(user, "Broken")); err != nil {
		t.Fatal(err)
	}

	catalog := NewCatalogWithRoots([]Root{
		{Path: user, Origin: OriginUser},
		{Path: system, Origin: OriginSystem},
	})
	got, err := catalog.Refresh(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := []ThemeSummary{
		{ID: "Alias", Name: "Contained", Origin: OriginUser},
		{ID: "ContainedTarget", Name: "Contained", Origin: OriginSystem},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Refresh() = %#v, want %#v", got, want)
	}
}

func writeThemeIndex(t *testing.T, root, id, content string) string {
	t.Helper()
	dir := filepath.Join(root, id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if content != "" {
		if err := os.WriteFile(filepath.Join(dir, "index.theme"), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}
