package template

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"

	"aether/internal/platform"
)

// customAppConfig represents the config.json structure inside a custom app folder.
type customAppConfig struct {
	Template    string `json:"template"`
	Destination string `json:"destination"`
}

// ProcessCustomApps scans ~/.config/aether/custom/ for app-specific templates,
// processes each template with variable substitution, writes the output to
// themeDir, creates destination symlinks, and runs any post-apply.sh scripts.
//
// Directory structure expected:
//
//	~/.config/aether/custom/
//	  cava/
//	    config.json      -> {"template": "theme.ini", "destination": "~/.config/cava/themes/aether"}
//	    theme.ini        -> Template file with {color} variables
//	    post-apply.sh    -> Optional script to run after apply
func ProcessCustomApps(themeDir string, variables map[string]string) error {
	customDir := platform.CustomDir()

	entries, err := os.ReadDir(customDir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		appName := entry.Name()
		appPath := filepath.Join(customDir, appName)

		if err := processCustomApp(appPath, appName, themeDir, variables); err != nil {
			log.Printf("[%s] Error processing custom app: %v", appName, err)
		}
	}

	return nil
}

// processCustomApp handles a single custom app directory: reads config.json,
// processes the template, writes output, creates symlink, and runs post-apply.
func processCustomApp(appPath, appName, themeDir string, variables map[string]string) error {
	// Read config.json
	configPath := filepath.Join(appPath, "config.json")
	if !platform.FileExists(configPath) {
		log.Printf("[%s] Missing config.json, skipping", appName)
		return nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	var config customAppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	if config.Template == "" {
		log.Printf("[%s] config.json missing 'template' field, skipping", appName)
		return nil
	}

	// Read and process the template
	templatePath := filepath.Join(appPath, config.Template)
	if !platform.FileExists(templatePath) {
		log.Printf("[%s] Template '%s' not found, skipping", appName, config.Template)
		return nil
	}

	content, err := platform.ReadText(templatePath)
	if err != nil {
		return err
	}

	processed := ProcessTemplate(content, variables)

	// Write processed output to theme directory
	outputFileName := appName + "-" + config.Template
	outputPath := filepath.Join(themeDir, outputFileName)
	if err := platform.WriteText(outputPath, processed); err != nil {
		return err
	}
	log.Printf("[%s] Processed template: %s", appName, config.Template)

	// Create destination symlink if configured
	if config.Destination != "" {
		destPath := expandHome(config.Destination)
		if err := platform.EnsureDir(filepath.Dir(destPath)); err != nil {
			return err
		}
		if err := platform.CreateSymlink(outputPath, destPath); err != nil {
			log.Printf("[%s] Error creating symlink to %s: %v", appName, destPath, err)
		} else {
			log.Printf("[%s] Symlinked -> %s", appName, destPath)
		}
	}

	// Run post-apply.sh if it exists
	postApplyPath := filepath.Join(appPath, "post-apply.sh")
	if platform.FileExists(postApplyPath) {
		if err := platform.RunAsync("bash", postApplyPath); err != nil {
			log.Printf("[%s] Error running post-apply.sh: %v", appName, err)
		} else {
			log.Printf("[%s] Executed post-apply.sh", appName)
		}
	}

	return nil
}

// expandHome replaces a leading "~/" with the user's home directory.
func expandHome(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[2:])
	}
	return path
}
