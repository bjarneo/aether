package theme

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsOmarchyInstalledRequiresPublicCLI(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Omarchy is only supported on Linux")
	}

	binDir := t.TempDir()
	t.Setenv("PATH", binDir)
	writeExecutable(t, filepath.Join(binDir, "omarchy-theme-set"))

	if IsOmarchyInstalled() {
		t.Fatal("IsOmarchyInstalled() = true with only an internal command")
	}

	writeExecutable(t, filepath.Join(binDir, "omarchy"))
	if !IsOmarchyInstalled() {
		t.Fatal("IsOmarchyInstalled() = false with public CLI")
	}
}

func writeExecutable(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
}
