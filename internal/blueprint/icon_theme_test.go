package blueprint

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestImportJSONIconThemeCompatibility(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		iconThemeJSON string
		wantField     bool
		wantMode      string
		wantID        string
		wantErr       string
	}{
		{name: "legacy absent is automatic"},
		{
			name:          "automatic canonical encoding is omitted",
			iconThemeJSON: `,"iconTheme":{"mode":"automatic"}`,
		},
		{
			name:          "explicit safe missing ID round trips",
			iconThemeJSON: `,"iconTheme":{"mode":"explicit","id":"Missing-But-Safe"}`,
			wantField:     true,
			wantMode:      "explicit",
			wantID:        "Missing-But-Safe",
		},
		{
			name:          "unsafe explicit ID is rejected",
			iconThemeJSON: `,"iconTheme":{"mode":"explicit","id":"../escape"}`,
			wantErr:       "iconTheme",
		},
		{
			name:          "unknown mode is rejected",
			iconThemeJSON: `,"iconTheme":{"mode":"installed","id":"Papirus"}`,
			wantErr:       "iconTheme",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(t.TempDir(), "theme.json")
			data := fmt.Sprintf(
				`{"name":"Portable","palette":{"colors":%s}%s}`,
				validPaletteJSON(),
				tt.iconThemeJSON,
			)
			if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
				t.Fatal(err)
			}

			bp, err := ImportJSON(path)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("ImportJSON accepted an invalid iconTheme")
				}
				if !strings.Contains(err.Error(), tt.wantErr) {
					t.Errorf("ImportJSON error = %q, want field context %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("ImportJSON: %v", err)
			}

			encoded, err := json.Marshal(bp)
			if err != nil {
				t.Fatal(err)
			}
			var raw map[string]json.RawMessage
			if err := json.Unmarshal(encoded, &raw); err != nil {
				t.Fatal(err)
			}
			field, found := raw["iconTheme"]
			if found != tt.wantField {
				t.Fatalf("marshaled iconTheme present = %v, want %v; JSON: %s", found, tt.wantField, encoded)
			}
			if !found {
				return
			}
			var selection struct {
				Mode string `json:"mode"`
				ID   string `json:"id"`
			}
			if err := json.Unmarshal(field, &selection); err != nil {
				t.Fatal(err)
			}
			if selection.Mode != tt.wantMode || selection.ID != tt.wantID {
				t.Errorf("iconTheme = %+v, want mode=%q id=%q", selection, tt.wantMode, tt.wantID)
			}
		})
	}
}

func validPaletteJSON() string {
	colors := make([]string, 16)
	for i := range colors {
		colors[i] = fmt.Sprintf("#%06x", i)
	}
	data, _ := json.Marshal(colors)
	return string(data)
}
