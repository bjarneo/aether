package cli

import (
	"embed"
	"io"
	"os"
	"strings"
	"testing"
)

func TestRunGenerateRejectsRemovedGTKOptions(t *testing.T) {
	for _, args := range [][]string{
		{"wallpaper.png", "--gtk"},
		{"wallpaper.png", "--no-gtk"},
		{"--gtk", "wallpaper.png"},
		{"wallpaper.png", "--output", "--gtk"},
	} {
		got, stderr := captureGenerateStderr(t, func() int {
			return runGenerate(args, embed.FS{})
		})
		if got != 1 {
			t.Errorf("runGenerate(%q) = %d, want 1", args, got)
		}
		if !strings.Contains(stderr, "Error: Unknown option:") {
			t.Errorf("runGenerate(%q) stderr = %q, want unknown option error", args, stderr)
		}
	}
}

func captureGenerateStderr(t *testing.T, run func() int) (int, string) {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	original := os.Stderr
	os.Stderr = w
	defer func() { os.Stderr = original }()

	code := run()
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	output, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	return code, string(output)
}
