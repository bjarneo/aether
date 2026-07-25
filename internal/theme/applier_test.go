package theme

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsOmarchyV4RequiresShellIntegration(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Omarchy is only supported on Linux")
	}

	binDir := t.TempDir()
	t.Setenv("PATH", binDir)
	writeExecutable(t, filepath.Join(binDir, "omarchy-theme-set"))

	if IsOmarchyV4() {
		t.Fatal("IsOmarchyV4() = true without omarchy-shell")
	}

	writeExecutable(t, filepath.Join(binDir, "omarchy-shell"))
	if !IsOmarchyV4() {
		t.Fatal("IsOmarchyV4() = false with v4 shell integration")
	}
}

func writeExecutable(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
}
