package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"aether/internal/icontheme"
	"aether/internal/pending"
)

func TestStageImportRejectsStaleConfirmation(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	app := NewApp()
	latest := &pending.Import{SourceURL: "aether://apply?wallpaper=https://example.com/new.png"}
	app.pending.curr = latest

	if _, err := app.stageImportIntoState("aether://apply?wallpaper=https://example.com/old.png"); err == nil {
		t.Fatal("stageImportIntoState() accepted a stale confirmation")
	}
	if app.pending.curr != latest {
		t.Fatal("stale confirmation replaced the latest pending import")
	}
}

func TestStageExternalBlueprintPreservesExplicitIconTheme(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())

	colors := make([]string, 16)
	for i := range colors {
		colors[i] = fmt.Sprintf("#%06x", i)
	}
	palette, err := json.Marshal(colors)
	if err != nil {
		t.Fatal(err)
	}
	themePath := filepath.Join(t.TempDir(), "external.json")
	data := fmt.Sprintf(
		`{"name":"External","palette":{"colors":%s},"iconTheme":{"mode":"explicit","id":"Missing-But-Safe"}}`,
		palette,
	)
	if err := os.WriteFile(themePath, []byte(data), 0o600); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	request := &pending.Import{SourceURL: "aether://test", ExternalTheme: themePath}
	app.pending.curr = request
	if _, err := app.stageImportIntoState(request.SourceURL); err != nil {
		t.Fatal(err)
	}
	want := (icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "Missing-But-Safe"})
	if app.state.IconTheme != want {
		t.Errorf("staged IconTheme = %+v, want %+v", app.state.IconTheme, want)
	}
}
