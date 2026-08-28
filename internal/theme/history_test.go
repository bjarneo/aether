package theme

import (
	"testing"

	"aether/internal/icontheme"
)

func TestHistoryRoundTripsIconThemeSelection(t *testing.T) {
	history := NewHistoryManager()
	automatic := *NewThemeState()
	explicit := automatic
	explicit.IconTheme = icontheme.Selection{Mode: icontheme.SelectionExplicit, ID: "Missing-But-Safe"}

	history.Push(automatic)
	restored, ok := history.Undo(explicit)
	if !ok || restored.IconTheme != icontheme.Automatic() {
		t.Fatalf("Undo() = %+v, %v; want Automatic", restored.IconTheme, ok)
	}
	restored, ok = history.Redo(restored)
	if !ok || restored.IconTheme != explicit.IconTheme {
		t.Fatalf("Redo() = %+v, %v; want %+v", restored.IconTheme, ok, explicit.IconTheme)
	}
}
