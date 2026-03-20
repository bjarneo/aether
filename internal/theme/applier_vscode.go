package theme

import (
	"embed"
	"log"
	"os"
	"path/filepath"

	"aether/internal/platform"
)

// ApplyVSCodeTheme installs the VSCode extension theme by copying the
// vscode-extension template directory from the embedded FS to
// ~/.vscode/extensions/theme-aether/, processing template variables along
// the way.
func ApplyVSCodeTheme(fsys embed.FS, templatesDir string, variables map[string]string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	extensionDir := filepath.Join(home, ".vscode", "extensions", "theme-aether")
	if err := platform.EnsureDir(extensionDir); err != nil {
		return err
	}

	if err := processVSCodeExtension(fsys, templatesDir, extensionDir, variables); err != nil {
		return err
	}

	log.Printf("VSCode theme extension installed to: %s", extensionDir)
	return nil
}
