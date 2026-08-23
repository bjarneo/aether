package main

import (
	"testing"

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
