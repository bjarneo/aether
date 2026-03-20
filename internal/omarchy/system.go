package omarchy

import (
	"os"
	"path/filepath"
	"strings"
)

// GetCurrentThemeName reads the active theme name.
func GetCurrentThemeName() string {
	home, _ := os.UserHomeDir()
	path := filepath.Join(home, ".config", "omarchy", "current", "theme.name")
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
