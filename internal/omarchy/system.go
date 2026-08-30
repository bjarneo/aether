package omarchy

import (
	"os"
	"path/filepath"
	"strings"
)

// GetCurrentThemeName reads the active theme name.
func GetCurrentThemeName() string {
	home, _ := os.UserHomeDir()
	paths := []string{
		filepath.Join(home, ".local", "state", "omarchy", "current", "theme.name"),
		filepath.Join(home, ".local", "state", "omarchy", "current", "theme"),
		filepath.Join(home, ".config", "omarchy", "current", "theme.name"),
	}
	for _, path := range paths {
		if name := readThemeName(path); name != "" {
			return name
		}
	}
	return ""
}

func readThemeName(path string) string {
	data, err := os.ReadFile(path)
	if err == nil {
		return strings.TrimSpace(string(data))
	}

	target, err := os.Readlink(path)
	if err != nil {
		return ""
	}
	return filepath.Base(filepath.Clean(target))
}
