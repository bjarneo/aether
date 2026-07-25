package theme

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPrepareOmarchyV4ThemeDirRemovesLegacyFiles(t *testing.T) {
	targetDir := t.TempDir()
	background := filepath.Join(targetDir, "backgrounds", "current.jpg")
	legacyFile := filepath.Join(targetDir, "waybar.css")
	legacyDir := filepath.Join(targetDir, "vscode-extension")

	if err := os.MkdirAll(filepath.Dir(background), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(background, []byte("background"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacyFile, []byte("legacy"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(legacyDir, 0o755); err != nil {
		t.Fatal(err)
	}

	if _, err := prepareOmarchyV4ThemeDir(targetDir, &ThemeState{}); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(background); err != nil {
		t.Errorf("background was removed: %v", err)
	}
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Errorf("legacy file still exists: %v", err)
	}
	if _, err := os.Stat(legacyDir); !os.IsNotExist(err) {
		t.Errorf("legacy directory still exists: %v", err)
	}
}
