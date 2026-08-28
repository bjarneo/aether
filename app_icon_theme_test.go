package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"aether/internal/blueprint"
	"aether/internal/icontheme"
	"aether/internal/theme"
)

func TestInstalledIconThemeWailsBoundary(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	writeAppTestIconTheme(t, root, "One", "One")
	app := &App{iconThemes: icontheme.NewCatalogWithRoots([]icontheme.Root{{
		Path: root, Origin: icontheme.OriginUser,
	}})}

	first, err := app.ListInstalledIconThemes()
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 1 || first[0].ID != "One" {
		t.Fatalf("ListInstalledIconThemes() = %#v, want One", first)
	}
	writeAppTestIconTheme(t, root, "Two", "Two")
	cached, err := app.ListInstalledIconThemes()
	if err != nil {
		t.Fatal(err)
	}
	if len(cached) != 1 {
		t.Errorf("cached list has %d themes, want 1", len(cached))
	}
	refreshed, err := app.RefreshInstalledIconThemes()
	if err != nil {
		t.Fatal(err)
	}
	if len(refreshed) != 2 {
		t.Errorf("refreshed list has %d themes, want 2", len(refreshed))
	}

	preview, err := app.GetIconThemePreview("One")
	if err != nil {
		t.Fatal(err)
	}
	if preview.ThemeID != "One" {
		t.Errorf("preview ThemeID = %q, want One", preview.ThemeID)
	}
	if _, err := app.GetIconThemePreview("../escape"); err == nil {
		t.Fatal("GetIconThemePreview accepted a path-like ID")
	}
	encoded, err := json.Marshal(struct {
		Themes  []icontheme.ThemeSummary `json:"themes"`
		Preview icontheme.ThemePreview   `json:"preview"`
	}{Themes: refreshed, Preview: preview})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), root) || strings.Contains(string(encoded), "path") {
		t.Errorf("Wails DTO leaked a path: %s", encoded)
	}
}

func TestSyncStateValidatesAndMirrorsIconTheme(t *testing.T) {
	app := &App{state: theme.NewThemeState()}
	want := (icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "Missing-But-Safe"})
	if err := app.SyncState(SyncStateRequest{IconTheme: want}); err != nil {
		t.Fatal(err)
	}
	if app.state.IconTheme != want {
		t.Errorf("synced IconTheme = %+v, want %+v", app.state.IconTheme, want)
	}
	if err := app.SyncState(SyncStateRequest{
		IconTheme: icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "../escape"},
	}); err == nil {
		t.Fatal("SyncState accepted an unsafe icon theme")
	}
	if app.state.IconTheme != want {
		t.Errorf("unsafe sync changed IconTheme to %+v, want preserved %+v", app.state.IconTheme, want)
	}
}

func TestLoadAndListBlueprintPreserveExplicitIconTheme(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())

	path := filepath.Join(t.TempDir(), "portable.json")
	data := fmt.Sprintf(
		`{"name":"Portable","palette":{"colors":%s},"iconTheme":{"mode":"explicit","id":"Missing-But-Safe"}}`,
		validAppTestPaletteJSON(),
	)
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatal(err)
	}
	bp, err := blueprint.ImportJSON(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := blueprint.SaveImported(bp); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	if err := app.LoadBlueprint("Portable"); err != nil {
		t.Fatal(err)
	}
	want := (icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "Missing-But-Safe"})
	if app.state.IconTheme != want {
		t.Errorf("loaded state IconTheme = %+v, want %+v", app.state.IconTheme, want)
	}

	listed, err := app.ListBlueprints()
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 {
		t.Fatalf("listed %d blueprints, want 1", len(listed))
	}
	if got, ok := listed[0]["iconTheme"].(icontheme.Selection); !ok || got != want {
		t.Errorf("listed iconTheme = %#v (%T), want %+v", listed[0]["iconTheme"], listed[0]["iconTheme"], want)
	}
}

func validAppTestPaletteJSON() string {
	colors := make([]string, 16)
	for i := range colors {
		colors[i] = fmt.Sprintf("#%06x", i)
	}
	data, _ := json.Marshal(colors)
	return string(data)
}

func writeAppTestIconTheme(t *testing.T, root, id, name string) {
	t.Helper()
	dir := filepath.Join(root, id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := fmt.Sprintf("[Icon Theme]\nName=%s\n", name)
	if err := os.WriteFile(filepath.Join(dir, "index.theme"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
