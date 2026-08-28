package cli

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"aether/internal/blueprint"
	"aether/internal/icontheme"
	"aether/internal/pending"
)

func TestShowBlueprintPrintsIconTheme(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	colors := make([]string, 16)
	for i := range colors {
		colors[i] = "#123456"
	}
	bp := blueprint.Blueprint{Palette: blueprint.PaletteData{Colors: colors}}
	if err := bp.SetIconThemeSelection(icontheme.Selection{
		Mode: icontheme.SelectionExplicit,
		ID:   "Missing-But-Safe",
	}); err != nil {
		t.Fatal(err)
	}
	if err := blueprint.NewService().Save("Portable", bp); err != nil {
		t.Fatal(err)
	}

	code, output := captureStdout(t, func() int {
		return runShowBlueprint([]string{"Portable"})
	})
	if code != 0 {
		t.Fatalf("runShowBlueprint() = %d, output %q", code, output)
	}
	if !strings.Contains(output, "Icon theme: Missing-But-Safe") {
		t.Errorf("show output = %q, want explicit icon theme", output)
	}
}

func TestBuildURLImportStatePreservesSafeMissingIconTheme(t *testing.T) {
	path := filepath.Join(t.TempDir(), "portable.json")
	data := `{
        "name":"Portable",
        "palette":{"colors":["#000000","#111111","#222222","#333333","#444444","#555555","#666666","#777777","#888888","#999999","#aaaaaa","#bbbbbb","#cccccc","#dddddd","#eeeeee","#ffffff"]},
        "iconTheme":{"mode":"explicit","id":"Missing-But-Safe"}
    }`
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatal(err)
	}
	state, err := buildURLImportState(&pending.Import{ExternalTheme: path})
	if err != nil {
		t.Fatal(err)
	}
	want := (icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "Missing-But-Safe"})
	if state.IconTheme != want {
		t.Errorf("URL import IconTheme = %+v, want %+v", state.IconTheme, want)
	}
}

func captureStdout(t *testing.T, run func() int) (int, string) {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	original := os.Stdout
	os.Stdout = w
	defer func() { os.Stdout = original }()
	code := run()
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	return code, string(data)
}
