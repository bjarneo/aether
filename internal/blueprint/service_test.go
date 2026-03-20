package blueprint

import (
	"encoding/json"
	"testing"
)

func TestLoadAllJSON(t *testing.T) {
	svc := NewService()
	bps, err := svc.LoadAll()
	if err != nil {
		t.Fatalf("LoadAll failed: %v", err)
	}
	t.Logf("Found %d blueprints", len(bps))

	// Test JSON serialization (what Wails does)
	data, err := json.Marshal(bps)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}
	t.Logf("JSON size: %d bytes", len(data))

	// Test round-trip
	var decoded []Blueprint
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}
	t.Logf("Decoded %d blueprints", len(decoded))
	if len(decoded) > 0 {
		t.Logf("First: %s — %d colors", decoded[0].Name, len(decoded[0].Palette.Colors))
	}
}
