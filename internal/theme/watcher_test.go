package theme

import (
	"path/filepath"
	"testing"
)

func TestCandidatePathsFallsBackToOmarchyStateTheme(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	paths := candidatePaths()
	if len(paths) < 2 {
		t.Fatalf("candidatePaths() returned %d paths, want at least 2", len(paths))
	}

	wantLegacy := filepath.Join(home, ".config", "omarchy", "current", "theme", "colors.toml")
	if paths[0] != wantLegacy {
		t.Fatalf("candidatePaths()[0] = %q, want %q", paths[0], wantLegacy)
	}

	wantState := filepath.Join(home, ".local", "state", "omarchy", "current", "theme", "colors.toml")
	if paths[1] != wantState {
		t.Fatalf("candidatePaths()[1] = %q, want %q", paths[1], wantState)
	}
}
