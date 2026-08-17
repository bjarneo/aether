package theme

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestRetireLegacyGTKStylesheetsHandlesLinkToGeneratedFile(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("GTK stylesheets were installed on Linux only")
	}

	home := t.TempDir()
	configDir := filepath.Join(home, ".config")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", configDir)

	generatedPath := filepath.Join(configDir, "aether", "theme", "gtk.css")
	installedPath := filepath.Join(configDir, "gtk-3.0", "gtk.css")
	legacyCSS := []byte("/* " + legacyGTKMarker + " */\n")
	userCSS := []byte("window { color: red; }\n")
	if err := os.MkdirAll(filepath.Dir(generatedPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(installedPath), 0o755); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, generatedPath, legacyCSS)
	writeTestFile(t, installedPath+".backup", userCSS)
	if err := os.Symlink(generatedPath, installedPath); err != nil {
		t.Fatal(err)
	}

	if err := RetireLegacyGTKStylesheets(); err != nil {
		t.Fatal(err)
	}
	info, err := os.Lstat(installedPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode()&os.ModeSymlink == 0 {
		t.Fatal("installed stylesheet symlink was replaced")
	}
	assertTestFileContents(t, generatedPath, userCSS)
	assertTestFileContents(t, installedPath+".backup", userCSS)
	assertTestFileContents(t, installedPath+".aether-legacy", legacyCSS)
}

func TestRetireLegacyGTKStylesheetRestoresUserBackup(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gtk.css")
	backupPath := path + ".backup"
	legacyCSS := []byte("/* " + legacyGTKMarker + " */\nwindow {}\n")
	userCSS := []byte("window { color: red; }\n")

	writeTestFile(t, path, legacyCSS)
	writeTestFile(t, backupPath, userCSS)

	retired, err := retireLegacyGTKStylesheet(path)
	if err != nil {
		t.Fatal(err)
	}
	if !retired {
		t.Fatal("legacy stylesheet was not retired")
	}
	assertTestFileContents(t, path, userCSS)
	assertTestFileContents(t, backupPath, userCSS)
	assertTestFileContents(t, path+".aether-legacy", legacyCSS)
}

func TestRetireLegacyGTKStylesheetLeavesUnownedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "gtk.css")
	userCSS := []byte("window { color: red; }\n")
	writeTestFile(t, path, userCSS)

	retired, err := retireLegacyGTKStylesheet(path)
	if err != nil {
		t.Fatal(err)
	}
	if retired {
		t.Fatal("unowned stylesheet was retired")
	}
	assertTestFileContents(t, path, userCSS)
}

func TestRetireLegacyGTKStylesheetDoesNotRestoreAetherBackup(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gtk.css")
	legacyCSS := []byte("/* " + legacyGTKMarker + " */\n")
	writeTestFile(t, path, legacyCSS)
	writeTestFile(t, path+".backup", legacyCSS)

	retired, err := retireLegacyGTKStylesheet(path)
	if err != nil {
		t.Fatal(err)
	}
	if !retired {
		t.Fatal("legacy stylesheet was not retired")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("active stylesheet still exists: %v", err)
	}
	assertTestFileContents(t, path+".backup", legacyCSS)
	assertTestFileContents(t, path+".aether-legacy", legacyCSS)
}

func TestRetireLegacyGTKStylesheetDoesNotFollowBackupSymlink(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gtk.css")
	target := filepath.Join(dir, "user.css")
	legacyCSS := []byte("/* " + legacyGTKMarker + " */\n")
	userCSS := []byte("window { color: red; }\n")
	writeTestFile(t, path, legacyCSS)
	writeTestFile(t, target, userCSS)
	if err := os.Symlink(target, path+".backup"); err != nil {
		t.Fatal(err)
	}

	retired, err := retireLegacyGTKStylesheet(path)
	if err != nil {
		t.Fatal(err)
	}
	if !retired {
		t.Fatal("legacy stylesheet was not retired")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("active stylesheet still exists: %v", err)
	}
	assertTestFileContents(t, target, userCSS)
	assertTestFileContents(t, path+".aether-legacy", legacyCSS)
}

func TestRetireLegacyGTKSymlinkRestoresTarget(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gtk.css")
	target := filepath.Join(dir, "managed.css")
	legacyCSS := []byte("/* " + legacyGTKMarker + " */\n")
	userCSS := []byte("window { color: red; }\n")
	writeTestFile(t, target, legacyCSS)
	writeTestFile(t, path+".backup", userCSS)
	if err := os.Symlink(target, path); err != nil {
		t.Fatal(err)
	}

	retired, err := retireLegacyGTKStylesheet(path)
	if err != nil {
		t.Fatal(err)
	}
	if !retired {
		t.Fatal("legacy stylesheet was not retired")
	}
	info, err := os.Lstat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode()&os.ModeSymlink == 0 {
		t.Fatal("stylesheet symlink was replaced")
	}
	assertTestFileContents(t, target, userCSS)
	assertTestFileContents(t, path+".backup", userCSS)
	assertTestFileContents(t, path+".aether-legacy", legacyCSS)
}

func writeTestFile(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertTestFileContents(t *testing.T, path string, want []byte) {
	t.Helper()
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Errorf("%s = %q, want %q", path, got, want)
	}
}
