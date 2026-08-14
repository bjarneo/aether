package update

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestRegisterURLHandler(t *testing.T) {
	dir := t.TempDir()
	argsPath := filepath.Join(dir, "args")
	commandPath := filepath.Join(dir, "xdg-mime")
	script := "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"" + argsPath + "\"\n"
	if err := os.WriteFile(commandPath, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, "data"))

	var stdout, stderr bytes.Buffer
	if err := registerURLHandler(context.Background(), &stdout, &stderr); err != nil {
		t.Fatal(err)
	}

	args, err := os.ReadFile(argsPath)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(args), "default\nli.oever.aether.url-handler.desktop\nx-scheme-handler/aether\n"; got != want {
		t.Errorf("xdg-mime arguments = %q; want %q", got, want)
	}
	if got, want := stdout.String(), "Registered aether:// as the default protocol handler.\n"; got != want {
		t.Errorf("stdout = %q; want %q", got, want)
	}
}
