package omarchy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestActivateThemeUsesPublicCLIAndExplicitBackground(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	logPath := filepath.Join(t.TempDir(), "commands")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	t.Setenv("AETHER_COMMAND_LOG", logPath)
	managedTheme := filepath.Join(home, ".config", "omarchy", "themes", "aether")
	if err := os.MkdirAll(managedTheme, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := MarkManagedTheme(managedTheme); err != nil {
		t.Fatal(err)
	}

	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "ethereal\n")
	script := "#!/bin/sh\nprintf '%s|%s\\n' \"$OMARCHY_THEME_SKIP_BACKGROUND\" \"$*\" >> \"$AETHER_COMMAND_LOG\"\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	wallpaper := filepath.Join(home, "wallpaper.png")
	if err := ActivateTheme("aether", wallpaper); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	want := []string{
		"|theme bg set " + wallpaper,
		"1|theme set aether",
	}
	if len(lines) != len(want) {
		t.Fatalf("commands = %q, want %q", lines, want)
	}
	for i := range want {
		if lines[i] != want[i] {
			t.Errorf("command %d = %q, want %q", i, lines[i], want[i])
		}
	}

	previous, err := os.ReadFile(filepath.Join(home, ".config", "aether", "previous-omarchy-theme"))
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(string(previous)); got != "ethereal" {
		t.Errorf("previous theme = %q, want ethereal", got)
	}
}

func TestActivateForeignThemeDoesNotReplaceRevertTarget(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)

	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "ethereal\n")
	if err := os.MkdirAll(filepath.Join(home, ".config", "omarchy", "themes", "foreign"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := ActivateTheme("foreign", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(previousThemeFile()); !os.IsNotExist(err) {
		t.Fatalf("foreign activation wrote previous theme: %v", err)
	}
}

func TestRevertThemeDoesNothingAfterExternalThemeChange(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	logPath := filepath.Join(t.TempDir(), "commands")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	t.Setenv("AETHER_COMMAND_LOG", logPath)

	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "foreign\n")
	writeThemeName(t, previousThemeFile(), "ethereal\n")
	script := "#!/bin/sh\nprintf '%s\n' \"$*\" >> \"$AETHER_COMMAND_LOG\"\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := RevertTheme(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("RevertTheme() invoked Omarchy after external change: %v", err)
	}
}

func TestRevertThemeFallsBackForLegacyManagedTheme(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	logPath := filepath.Join(t.TempDir(), "commands")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	t.Setenv("AETHER_COMMAND_LOG", logPath)

	managedTheme := filepath.Join(home, ".config", "omarchy", "themes", "aether")
	if err := os.MkdirAll(managedTheme, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := MarkManagedTheme(managedTheme); err != nil {
		t.Fatal(err)
	}
	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "aether\n")
	script := "#!/bin/sh\nprintf '%s\n' \"$*\" >> \"$AETHER_COMMAND_LOG\"\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := RevertTheme(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(string(data)); got != "theme set tokyo-night" {
		t.Fatalf("command = %q, want theme set tokyo-night", got)
	}
}

func TestActivateThemeReturnsCommandOutput(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	script := "#!/bin/sh\necho 'theme transaction failed' >&2\nexit 7\n"
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	err := ActivateTheme("aether", "")
	if err == nil || !strings.Contains(err.Error(), "theme transaction failed") {
		t.Fatalf("ActivateTheme() error = %v, want command stderr", err)
	}
}

func TestActivateThemeDoesNotChangeThemeWhenBackgroundFails(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	logPath := filepath.Join(t.TempDir(), "commands")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	t.Setenv("AETHER_COMMAND_LOG", logPath)

	managedTheme := filepath.Join(home, ".config", "omarchy", "themes", "aether")
	if err := os.MkdirAll(managedTheme, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := MarkManagedTheme(managedTheme); err != nil {
		t.Fatal(err)
	}
	writeThemeName(t, filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"), "ethereal\n")
	script := `#!/bin/sh
printf '%s\n' "$*" >> "$AETHER_COMMAND_LOG"
if [ "$1 $2 $3" = "theme bg set" ]; then
    echo "background failed" >&2
    exit 7
fi
`
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	err := ActivateTheme("aether", filepath.Join(home, "wallpaper.png"))
	if err == nil || !strings.Contains(err.Error(), "background failed") {
		t.Fatalf("ActivateTheme() error = %v, want background error", err)
	}
	data, readErr := os.ReadFile(logPath)
	if readErr != nil {
		t.Fatal(readErr)
	}
	want := "theme bg set " + filepath.Join(home, "wallpaper.png")
	if got := strings.TrimSpace(string(data)); got != want {
		t.Fatalf("commands = %q, want %q", got, want)
	}
}

func TestActivateThemeRestoresBackgroundWhenThemeSetFails(t *testing.T) {
	home := t.TempDir()
	binDir := t.TempDir()
	logPath := filepath.Join(t.TempDir(), "commands")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("PATH", binDir)
	t.Setenv("AETHER_COMMAND_LOG", logPath)

	managedTheme := filepath.Join(home, ".config", "omarchy", "themes", "aether")
	if err := os.MkdirAll(managedTheme, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := MarkManagedTheme(managedTheme); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(home, ".local", "state", "omarchy", "current")
	writeThemeName(t, filepath.Join(stateDir, "theme.name"), "aether\n")
	oldBackground := filepath.Join(home, "old.png")
	if err := os.WriteFile(oldBackground, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(oldBackground, filepath.Join(stateDir, "background")); err != nil {
		t.Fatal(err)
	}
	script := `#!/bin/sh
printf '%s\n' "$*" >> "$AETHER_COMMAND_LOG"
if [ "$1 $2" = "theme set" ]; then
    echo "theme failed" >&2
    exit 7
fi
`
	if err := os.WriteFile(filepath.Join(binDir, "omarchy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	newBackground := filepath.Join(home, "new.png")
	err := ActivateTheme("aether", newBackground)
	if err == nil || !strings.Contains(err.Error(), "theme failed") {
		t.Fatalf("ActivateTheme() error = %v, want theme activation error", err)
	}
	data, readErr := os.ReadFile(logPath)
	if readErr != nil {
		t.Fatal(readErr)
	}
	want := "theme bg set " + newBackground + "\ntheme set aether\ntheme bg set " + oldBackground
	if got := strings.TrimSpace(string(data)); got != want {
		t.Fatalf("commands = %q, want %q", got, want)
	}
}
