package platform

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEnsureURLHandlerRegistersMissingDefault(t *testing.T) {
	dir := t.TempDir()
	argsPath := filepath.Join(dir, "args")
	commandPath := filepath.Join(dir, "xdg-mime")
	script := fmt.Sprintf("#!/bin/sh\nif [ \"$1\" = query ]; then exit 0; fi\nprintf '%%s\\n' \"$@\" > %q\n", argsPath)
	if err := os.WriteFile(commandPath, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, "data"))

	if err := EnsureURLHandler(context.Background()); err != nil {
		t.Fatal(err)
	}

	args, err := os.ReadFile(argsPath)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(args), "default\nli.oever.aether.url-handler.desktop\nx-scheme-handler/aether\n"; got != want {
		t.Errorf("xdg-mime arguments = %q; want %q", got, want)
	}
	entry, err := os.ReadFile(filepath.Join(dir, "data", "applications", urlHandlerDesktopFile))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(entry), "MimeType=x-scheme-handler/aether;") {
		t.Error("desktop entry does not register the aether URL scheme")
	}
}

func TestEnsureURLHandlerSkipsRegisteredDefault(t *testing.T) {
	dir := t.TempDir()
	argsPath := filepath.Join(dir, "args")
	commandPath := filepath.Join(dir, "xdg-mime")
	script := fmt.Sprintf("#!/bin/sh\nif [ \"$1\" = query ]; then printf '%%s\\n' %q; exit 0; fi\nprintf '%%s\\n' \"$@\" > %q\n", urlHandlerDesktopFile, argsPath)
	if err := os.WriteFile(commandPath, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, "data"))

	if err := EnsureURLHandler(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(argsPath); !os.IsNotExist(err) {
		t.Errorf("xdg-mime default ran, err = %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "data", "applications", urlHandlerDesktopFile)); !os.IsNotExist(err) {
		t.Errorf("desktop entry was created, err = %v", err)
	}
}
