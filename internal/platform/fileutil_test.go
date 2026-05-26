package platform_test

import (
	"os"
	"path/filepath"
	"testing"

	"aether/internal/platform"
)

func TestReplaceSymlinkReplacesOnlySymlinks(t *testing.T) {
	dir := t.TempDir()
	firstTarget := filepath.Join(dir, "first")
	secondTarget := filepath.Join(dir, "second")
	link := filepath.Join(dir, "link")

	if err := os.WriteFile(firstTarget, []byte("first"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(secondTarget, []byte("second"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := platform.ReplaceSymlink(firstTarget, link); err != nil {
		t.Fatal(err)
	}
	if err := platform.ReplaceSymlink(secondTarget, link); err != nil {
		t.Fatal(err)
	}
	if got, err := os.Readlink(link); err != nil || got != secondTarget {
		t.Fatalf("link = %q, %v; want %q", got, err, secondTarget)
	}
}

func TestReplaceSymlinkRefusesRealPath(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target")
	link := filepath.Join(dir, "real-file")

	if err := os.WriteFile(target, []byte("target"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(link, []byte("user config"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := platform.ReplaceSymlink(target, link); err == nil {
		t.Fatal("expected error for non-symlink path")
	}
	if data, err := os.ReadFile(link); err != nil || string(data) != "user config" {
		t.Fatalf("real path changed: %q, %v", string(data), err)
	}
}
