package theme

import (
	"log"
	"os"
	"path/filepath"

	"aether/internal/platform"
)

// zedOutputFilename is the name used for the installed Zed theme file.
const zedOutputFilename = "aether.json"

// zedSourceFilename is the name of the Zed template file in the theme directory.
const zedSourceFilename = "aether.zed.json"

// ApplyZedTheme copies the generated aether.zed.json from themeDir to
// ~/.config/zed/themes/aether.json.
func ApplyZedTheme(themeDir string) error {
	sourcePath := filepath.Join(themeDir, zedSourceFilename)

	if !platform.FileExists(sourcePath) {
		log.Printf("%s not found in theme directory, skipping Zed theme application", zedSourceFilename)
		return nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	zedThemesDir := filepath.Join(home, ".config", "zed", "themes")
	if err := platform.EnsureDir(zedThemesDir); err != nil {
		return err
	}

	destPath := filepath.Join(zedThemesDir, zedOutputFilename)
	if err := platform.CopyFile(sourcePath, destPath); err != nil {
		return err
	}

	log.Printf("Copied Zed theme to: %s", destPath)
	return nil
}
