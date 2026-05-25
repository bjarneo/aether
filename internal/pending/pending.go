// Package pending stages a one-click theme import requested by a remote
// source (a web link, a CLI invocation) so the GUI can show a confirmation
// dialog before applying anything. The URL handler writes the staged file;
// the GUI consumes it on startup or via the "pending-import" IPC verb.
package pending

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"aether/internal/platform"
)

// Import describes the assets a remote source is asking Aether to apply.
// All paths are local cache paths, populated by the URL handler after the
// originating HTTPS resources have been downloaded.
type Import struct {
	ExternalTheme string `json:"external_theme,omitempty"`
	ColorsToml    string `json:"colors_toml,omitempty"`
	Wallpaper     string `json:"wallpaper,omitempty"`
	Mode          string `json:"mode,omitempty"`   // "light" | "dark" — empty leaves the current setting alone
	Silent        bool   `json:"silent,omitempty"` // skip the confirm dialog and apply immediately
	SourceURL     string `json:"source_url,omitempty"`
	Timestamp     int64  `json:"ts,omitempty"`
}

// Path returns the location of the handoff file.
func Path() string {
	return filepath.Join(platform.CacheDir(), "pending-import.json")
}

// Write persists a staged import for the GUI to pick up.
func Write(p *Import) error {
	if err := platform.EnsureDir(platform.CacheDir()); err != nil {
		return fmt.Errorf("ensure cache dir: %w", err)
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	if err := os.WriteFile(Path(), data, 0600); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

// Read returns the staged import if one exists. Missing file returns
// (nil, nil), which the caller treats as "nothing pending".
func Read() (*Import, error) {
	data, err := os.ReadFile(Path())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var p Import
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse: %w", err)
	}
	return &p, nil
}

// Clear removes the handoff file. Called once the GUI has loaded it into
// memory so a subsequent restart does not re-prompt.
func Clear() error {
	if err := os.Remove(Path()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
