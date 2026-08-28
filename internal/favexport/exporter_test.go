package favexport

import (
	"archive/zip"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"
)

// stubDownloader stands in for the wallhaven client. Remote URLs map to files
// that already exist on disk, so the tests never touch the network.
type stubDownloader struct {
	files   map[string]string // url -> local path
	block   chan struct{}     // when non-nil, downloads wait on it or on ctx
	calls   int
	failAll bool
}

func (s *stubDownloader) DownloadContext(ctx context.Context, url string) (string, error) {
	s.calls++
	if s.block != nil {
		select {
		case <-s.block:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}
	if s.failAll {
		return "", context.DeadlineExceeded
	}
	local, ok := s.files[url]
	if !ok {
		return "", os.ErrNotExist
	}
	return local, nil
}

func writeFixture(t *testing.T, dir, name, content string) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return path
}

// runExport starts an export and waits for it to settle.
func runExport(t *testing.T, e *Exporter, items []Item, destDir string) string {
	t.Helper()
	zipPath, err := e.Start(context.Background(), items, destDir)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitIdle(t, e)
	return zipPath
}

func waitIdle(t *testing.T, e *Exporter) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for e.IsRunning() {
		if time.Now().After(deadline) {
			t.Fatal("export did not finish within 5s")
		}
		time.Sleep(2 * time.Millisecond)
	}
}

// zipEntries lists the archive's entry names, sorted.
func zipEntries(t *testing.T, zipPath string) []string {
	t.Helper()
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("open %s: %v", zipPath, err)
	}
	defer r.Close()

	names := make([]string, 0, len(r.File))
	for _, f := range r.File {
		names = append(names, f.Name)
	}
	sort.Strings(names)
	return names
}

func readZipEntry(t *testing.T, zipPath, name string) []byte {
	t.Helper()
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("open %s: %v", zipPath, err)
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name != name {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open entry %s: %v", name, err)
		}
		defer rc.Close()
		data, err := io.ReadAll(rc)
		if err != nil {
			t.Fatalf("read entry %s: %v", name, err)
		}
		return data
	}
	t.Fatalf("entry %s not found in %s", name, zipPath)
	return nil
}

func assertNoLeftovers(t *testing.T, zipPath string) {
	t.Helper()
	if _, err := os.Stat(zipPath); err == nil {
		t.Errorf("expected no archive at %s", zipPath)
	}
	if _, err := os.Stat(zipPath + ".part"); err == nil {
		t.Errorf("expected no partial archive at %s.part", zipPath)
	}
}

func TestExportArchivesLocalAndRemoteWithManifest(t *testing.T) {
	src := t.TempDir()
	dest := t.TempDir()

	local := writeFixture(t, src, "sunset.jpg", "local-bytes")
	remoteLocal := writeFixture(t, src, "wallhaven-abc123.jpg", "remote-bytes")

	dl := &stubDownloader{files: map[string]string{
		"https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg": remoteLocal,
	}}

	items := []Item{
		{Path: local, Name: "sunset.jpg", Meta: map[string]interface{}{"type": "local"}},
		{
			Path: "https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg",
			Name: "abc123",
			Meta: map[string]interface{}{"type": "wallhaven", "id": "abc123"},
		},
	}

	zipPath := runExport(t, New(dl), items, dest)

	got := zipEntries(t, zipPath)
	want := []string{"abc123.jpg", manifestName, "sunset.jpg"}
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("entries = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("entries = %v, want %v", got, want)
		}
	}

	if body := string(readZipEntry(t, zipPath, "sunset.jpg")); body != "local-bytes" {
		t.Errorf("sunset.jpg = %q, want %q", body, "local-bytes")
	}

	var manifest []manifestEntry
	if err := json.Unmarshal(readZipEntry(t, zipPath, manifestName), &manifest); err != nil {
		t.Fatalf("manifest: %v", err)
	}
	if len(manifest) != 2 {
		t.Fatalf("manifest has %d entries, want 2", len(manifest))
	}
	if manifest[1].Source != items[1].Path {
		t.Errorf("manifest source = %q, want %q", manifest[1].Source, items[1].Path)
	}
	if manifest[1].Meta["id"] != "abc123" {
		t.Errorf("manifest meta id = %v, want abc123", manifest[1].Meta["id"])
	}
}

// A wallhaven id has no extension; the one from the URL should be borrowed so
// the archived file stays openable.
func TestEntryLabelBorrowsExtensionFromPath(t *testing.T) {
	got := entryLabel(Item{Path: "https://w.wallhaven.cc/full/ab/wallhaven-abc.png", Name: "abc"})
	if got != "abc.png" {
		t.Errorf("entryLabel = %q, want abc.png", got)
	}
}

func TestExportDeduplicatesEntryNames(t *testing.T) {
	root := t.TempDir()
	dest := t.TempDir()

	a := writeFixture(t, filepath.Join(root, "a"), "wall.jpg", "a")
	b := writeFixture(t, filepath.Join(root, "b"), "wall.jpg", "b")

	zipPath := runExport(t, New(nil), []Item{{Path: a}, {Path: b}}, dest)

	got := zipEntries(t, zipPath)
	want := []string{manifestName, "wall-2.jpg", "wall.jpg"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("entries = %v, want %v", got, want)
		}
	}
	if body := string(readZipEntry(t, zipPath, "wall-2.jpg")); body != "b" {
		t.Errorf("wall-2.jpg = %q, want %q", body, "b")
	}
}

func TestExportSkipsUnreachableItemsButKeepsGoing(t *testing.T) {
	src := t.TempDir()
	dest := t.TempDir()

	good := writeFixture(t, src, "good.jpg", "good")
	dl := &stubDownloader{failAll: true}

	items := []Item{
		{Path: filepath.Join(src, "missing.jpg")},
		{Path: good},
		{Path: "https://w.wallhaven.cc/full/zz/wallhaven-zzz.jpg"},
	}

	zipPath := runExport(t, New(dl), items, dest)

	got := zipEntries(t, zipPath)
	want := []string{manifestName, "good.jpg"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("entries = %v, want %v", got, want)
	}
}

func TestExportFailsWhenNothingIsExportable(t *testing.T) {
	src := t.TempDir()
	dest := t.TempDir()

	items := []Item{{Path: filepath.Join(src, "nope.jpg")}}
	zipPath := runExport(t, New(nil), items, dest)

	assertNoLeftovers(t, zipPath)
}

func TestCancelLeavesNoArchiveBehind(t *testing.T) {
	dest := t.TempDir()
	dl := &stubDownloader{block: make(chan struct{})}
	e := New(dl)

	zipPath, err := e.Start(context.Background(), []Item{
		{Path: "https://w.wallhaven.cc/full/aa/wallhaven-aaa.jpg"},
	}, dest)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	e.Cancel()
	waitIdle(t, e)
	assertNoLeftovers(t, zipPath)
}

func TestStartRejectsEmptySelection(t *testing.T) {
	if _, err := New(nil).Start(context.Background(), nil, t.TempDir()); err == nil {
		t.Fatal("expected an error for an empty selection")
	}
}

func TestStartRejectsConcurrentExports(t *testing.T) {
	dest := t.TempDir()
	dl := &stubDownloader{block: make(chan struct{})}
	e := New(dl)

	items := []Item{{Path: "https://w.wallhaven.cc/full/aa/wallhaven-aaa.jpg"}}
	if _, err := e.Start(context.Background(), items, dest); err != nil {
		t.Fatalf("first Start: %v", err)
	}
	if _, err := e.Start(context.Background(), items, dest); err == nil {
		t.Error("expected the second Start to be rejected")
	}

	e.Cancel()
	waitIdle(t, e)
}

func TestArchiveNameNeverOverwritesAnExistingExport(t *testing.T) {
	src := t.TempDir()
	dest := t.TempDir()
	fixture := writeFixture(t, src, "wall.jpg", "x")

	e := New(nil)
	first := runExport(t, e, []Item{{Path: fixture}}, dest)
	second := runExport(t, e, []Item{{Path: fixture}}, dest)

	if first == second {
		t.Fatalf("second export reused %s", first)
	}
	if _, err := os.Stat(first); err != nil {
		t.Errorf("first archive was clobbered: %v", err)
	}
	if filepath.Base(second) != archiveBaseName()+"-2.zip" {
		t.Errorf("second archive = %s, want %s-2.zip", filepath.Base(second), archiveBaseName())
	}
}

func TestSanitizeNameStripsPathTraversal(t *testing.T) {
	if got := entryLabel(Item{Path: "/tmp/x.jpg", Name: "../../etc/passwd"}); got != "etcpasswd.jpg" {
		t.Errorf("entryLabel = %q, want etcpasswd.jpg", got)
	}
}
