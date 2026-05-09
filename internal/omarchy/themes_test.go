package omarchy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestThemeSearchDirsExtraDirsFirst(t *testing.T) {
	t.Setenv(extraThemeDirsEnv, "/tmp/aether-test-themes:/opt/themes")

	dirs := themeSearchDirs()
	if len(dirs) < 5 {
		t.Fatalf("expected at least 5 dirs (2 extra + 3 default), got %d: %v", len(dirs), dirs)
	}
	if dirs[0] != "/tmp/aether-test-themes" {
		t.Errorf("first dir = %q, want /tmp/aether-test-themes", dirs[0])
	}
	if dirs[1] != "/opt/themes" {
		t.Errorf("second dir = %q, want /opt/themes", dirs[1])
	}

	home, _ := os.UserHomeDir()
	expectedDefaults := []string{
		filepath.Join(home, ".config", "omarchy", "themes"),
		filepath.Join(home, ".local", "share", "omarchy", "themes"),
		filepath.Join(home, ".config", "themes"),
	}
	for i, want := range expectedDefaults {
		got := dirs[2+i]
		if got != want {
			t.Errorf("default dir[%d] = %q, want %q", i, got, want)
		}
	}
}

func TestThemeSearchDirsEmptyEntries(t *testing.T) {
	t.Setenv(extraThemeDirsEnv, ":/foo::/bar:")

	dirs := themeSearchDirs()
	got := strings.Join(dirs, ",")
	if !strings.Contains(got, "/foo") || !strings.Contains(got, "/bar") {
		t.Errorf("expected /foo and /bar in dirs, got %v", dirs)
	}
	for _, d := range dirs {
		if d == "" {
			t.Errorf("empty entry leaked into dirs: %v", dirs)
		}
	}
}

func TestThemeSearchDirsNoEnv(t *testing.T) {
	t.Setenv(extraThemeDirsEnv, "")

	dirs := themeSearchDirs()
	if len(dirs) != 3 {
		t.Errorf("expected 3 default dirs without env, got %d: %v", len(dirs), dirs)
	}
}
