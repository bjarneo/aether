package theme

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"aether/internal/platform"
	"aether/internal/template"
)

// templateAppNameMap maps template file names to standardised app names,
// used for per-app override lookups.
var templateAppNameMap = map[string]string{
	"alacritty.toml":    "alacritty",
	"btop.theme":        "btop",
	"chromium.theme":    "chromium",
	"foot.ini":          "foot",
	"ghostty.conf":      "ghostty",
	"hyprland.conf":     "hyprland",
	"hyprlock.conf":     "hyprlock",
	"icons.theme":       "icons",
	"kitty.conf":        "kitty",
	"mako.ini":          "mako",
	"neovim.lua":        "neovim",
	"swayosd.css":       "swayosd",
	"walker.css":        "walker",
	"waybar.css":        "waybar",
	"wofi.css":          "wofi",
	"vencord.theme.css": "vencord",
	"warp.yaml":         "warp",
	"colors.toml":       "colors",
}

// getAppNameFromFileName returns the app name for a given template file name.
func getAppNameFromFileName(fileName string) string {
	if name, ok := templateAppNameMap[fileName]; ok {
		return name
	}
	parts := strings.SplitN(fileName, ".", 2)
	return parts[0]
}

// GetAppNameFromFileName is the exported variant of getAppNameFromFileName.
func GetAppNameFromFileName(fileName string) string {
	return getAppNameFromFileName(fileName)
}

// Settings holds the toggles that control which optional templates are
// processed and applied.
type Settings struct {
	IncludeZed           bool            `json:"includeZed"`
	IncludeVscode        bool            `json:"includeVscode"`
	IncludeNeovim        bool            `json:"includeNeovim"`
	SelectedNeovimConfig string          `json:"selectedNeovimConfig"`
	ExcludedApps         map[string]bool `json:"excludedApps,omitempty"`
}

// DefaultApplySettings returns the same defaults `aether --generate` uses.
// Use this anywhere the user is applying a theme without picking per-app
// toggles explicitly so a bare `Settings{}` does not silently drop editor
// integrations from the output.
func DefaultApplySettings() Settings {
	return Settings{
		IncludeZed:    true,
		IncludeVscode: true,
		IncludeNeovim: true,
	}
}

// ApplyResult is returned by ApplyTheme with the outcome of theme application.
type ApplyResult struct {
	Success   bool   `json:"success"`
	IsOmarchy bool   `json:"isOmarchy"`
	ThemePath string `json:"themePath"`
}

// Writer processes templates from an embed.FS and generates theme files.
type Writer struct {
	templatesFS  embed.FS
	templatesDir string // root directory name inside the embed.FS (e.g. "templates")
}

// NewWriter creates a Writer that reads templates from the given embed.FS.
// dir is the root directory name inside the FS (typically "templates").
func NewWriter(fsys embed.FS, dir string) *Writer {
	return &Writer{
		templatesFS:  fsys,
		templatesDir: dir,
	}
}

// prepareThemeDir creates the theme directory, cleans the backgrounds subdir,
// and copies wallpaper + additional images. Returns the wallpaper destination path.
// If no wallpaper or additional images are provided, existing backgrounds are preserved.
func prepareThemeDir(targetDir string, state *ThemeState) (string, error) {
	bgDir := filepath.Join(targetDir, "backgrounds")
	if err := platform.EnsureDir(bgDir); err != nil {
		return "", err
	}
	// Remove Aether-owned output left by versions that supported GTK styling.
	if err := removeLegacyGTKStylesheet(filepath.Join(targetDir, "gtk.css")); err != nil {
		return "", err
	}

	// Only clean backgrounds when we have new content to replace them with.
	// This preserves the current wallpaper when applying color-only blueprints.
	hasNewBackgrounds := state.WallpaperPath != "" || len(state.AdditionalImages) > 0
	if hasNewBackgrounds {
		if err := platform.CleanDir(bgDir); err != nil {
			return "", err
		}
	}

	wallpaperDest := ""
	if state.WallpaperPath != "" {
		destPath := filepath.Join(bgDir, filepath.Base(state.WallpaperPath))
		if err := platform.CopyFile(state.WallpaperPath, destPath); err != nil {
			log.Printf("Warning: could not copy wallpaper: %v", err)
		} else {
			wallpaperDest = destPath
		}
	}

	for i, src := range state.AdditionalImages {
		destPath := filepath.Join(bgDir, filepath.Base(src))
		if err := platform.CopyFile(src, destPath); err != nil {
			log.Printf("Warning: could not copy additional image %d: %v", i+1, err)
		}
	}

	return wallpaperDest, nil
}

// prepareOmarchyV4ThemeDir removes legacy generated files while preserving the
// selected backgrounds for color-only applies.
func prepareOmarchyV4ThemeDir(targetDir string, state *ThemeState) (string, error) {
	if err := platform.EnsureDir(targetDir); err != nil {
		return "", err
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return "", err
	}
	for _, entry := range entries {
		if entry.Name() == "backgrounds" {
			continue
		}
		if err := os.RemoveAll(filepath.Join(targetDir, entry.Name())); err != nil {
			return "", err
		}
	}

	return prepareThemeDir(targetDir, state)
}

// applyEditorThemes applies optional editor themes (Zed, VSCode).
func (w *Writer) applyEditorThemes(themeDir string, settings Settings, variables map[string]string) {
	if settings.IncludeZed {
		if err := ApplyZedTheme(themeDir); err != nil {
			log.Printf("Warning: Zed theme application failed: %v", err)
		}
	}
	if settings.IncludeVscode {
		if err := ApplyVSCodeTheme(w.templatesFS, w.templatesDir, variables); err != nil {
			log.Printf("Warning: VSCode theme application failed: %v", err)
		}
	}
}

// processOmarchyV4Templates renders the files Omarchy v4 reads directly from
// a theme directory. Other application configs are generated by Omarchy.
func (w *Writer) processOmarchyV4Templates(
	themeDir string,
	variables map[string]string,
	appOverrides map[string]map[string]string,
	globalOverrides map[string]string,
) {
	w.processTemplate(
		"colors.v4.toml",
		filepath.Join(themeDir, "colors.toml"),
		variables,
		appOverrides,
		globalOverrides,
	)
	w.processTemplate(
		"icons.theme",
		filepath.Join(themeDir, "icons.theme"),
		variables,
		appOverrides,
		globalOverrides,
	)
}

// GenerateOmarchyV4Only writes the files Omarchy v4 reads directly from a
// reusable theme folder. Omarchy generates all other app-specific files.
func (w *Writer) GenerateOmarchyV4Only(state *ThemeState, outputPath string) error {
	if _, err := prepareOmarchyV4ThemeDir(outputPath, state); err != nil {
		return err
	}
	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	w.processOmarchyV4Templates(outputPath, variables, state.AppOverrides, state.ExtendedColors)
	return nil
}

// ApplyTheme generates all theme files and applies the theme to the system.
func (w *Writer) ApplyTheme(state *ThemeState, settings Settings) (*ApplyResult, error) {
	if err := RetireLegacyGTKStylesheets(); err != nil {
		log.Printf("Warning: legacy GTK stylesheet cleanup failed: %v", err)
	}

	isOmarchy := IsOmarchyInstalled()
	isOmarchyV4 := isOmarchy && IsOmarchyV4()
	themeDir := platform.ThemeDir()

	var wallpaperDest string
	var err error
	if isOmarchyV4 {
		wallpaperDest, err = prepareOmarchyV4ThemeDir(themeDir, state)
	} else {
		wallpaperDest, err = prepareThemeDir(themeDir, state)
	}
	if err != nil {
		return &ApplyResult{Success: false, IsOmarchy: isOmarchy, ThemePath: themeDir}, err
	}

	if isOmarchy {
		if err := CreateOmarchySymlink(themeDir); err != nil {
			log.Printf("Warning: could not create omarchy symlink: %v", err)
		}
	}

	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	if isOmarchyV4 {
		w.processOmarchyV4Templates(themeDir, variables, state.AppOverrides, state.ExtendedColors)
		if err := template.ProcessCustomApps(themeDir, variables); err != nil {
			log.Printf("Warning: custom app processing failed: %v", err)
		}
	} else {
		w.processTemplates(variables, themeDir, settings, state.AppOverrides, state.ExtendedColors)
		w.applyEditorThemes(themeDir, settings, variables)

		if err := HandleLightModeMarker(themeDir, state.LightMode); err != nil {
			log.Printf("Warning: light mode marker failed: %v", err)
		}
		if err := template.ProcessCustomApps(themeDir, variables); err != nil {
			log.Printf("Warning: custom app processing failed: %v", err)
		}
	}
	if isOmarchy {
		if err := ApplyOmarchyTheme(); err != nil {
			log.Printf("Warning: omarchy theme application failed: %v", err)
		}
	}
	if wallpaperDest != "" {
		if err := ApplyWallpaper(wallpaperDest); err != nil {
			log.Printf("Warning: wallpaper application failed: %v", err)
		}
	}

	return &ApplyResult{Success: true, IsOmarchy: isOmarchy, ThemePath: themeDir}, nil
}

// GenerateOnly generates theme files to the specified output path without
// applying them (no symlinks, no service restarts, no omarchy activation).
func (w *Writer) GenerateOnly(state *ThemeState, settings Settings, outputPath string) error {
	targetDir := outputPath
	if targetDir == "" {
		targetDir = platform.ThemeDir()
	}
	if err := platform.EnsureDir(targetDir); err != nil {
		return err
	}

	if _, err := prepareThemeDir(targetDir, state); err != nil {
		return err
	}

	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	w.processTemplates(variables, targetDir, settings, state.AppOverrides, state.ExtendedColors)

	// Generate VSCode extension into the export directory
	if settings.IncludeVscode {
		vscodeDir := filepath.Join(targetDir, "vscode-extension")
		if err := processVSCodeExtension(w.templatesFS, w.templatesDir, vscodeDir, variables); err != nil {
			log.Printf("Warning: VSCode extension export failed: %v", err)
		}
	}

	if err := HandleLightModeMarker(targetDir, state.LightMode); err != nil {
		log.Printf("Warning: light mode marker failed: %v", err)
	}

	log.Printf("Theme files generated to: %s", targetDir)
	return nil
}

// processTemplates reads each template from the embedded FS, applies variable
// substitution, and writes the result to outputDir. Certain templates are
// skipped based on settings.
func (w *Writer) processTemplates(
	variables map[string]string,
	outputDir string,
	settings Settings,
	appOverrides map[string]map[string]string,
	globalOverrides map[string]string,
) {
	names, err := template.ListTemplates(w.templatesFS, w.templatesDir)
	if err != nil {
		log.Printf("Error listing templates: %v", err)
		return
	}

	for _, fileName := range names {
		// Skip copy.json (config file) and the Omarchy v4-only colors template.
		if fileName == "copy.json" || fileName == "colors.v4.toml" {
			continue
		}

		// Skip neovim.lua if includeNeovim is false
		if fileName == "neovim.lua" && !settings.IncludeNeovim {
			continue
		}

		// Skip aether.zed.json if includeZed is false
		if fileName == "aether.zed.json" && !settings.IncludeZed {
			continue
		}

		// Skip vscode.json if includeVscode is false
		if fileName == "vscode.json" && !settings.IncludeVscode {
			continue
		}

		outputPath := filepath.Join(outputDir, fileName)

		// Handle neovim.lua with custom config selection
		if fileName == "neovim.lua" && settings.SelectedNeovimConfig != "" {
			if err := platform.WriteText(outputPath, settings.SelectedNeovimConfig); err != nil {
				log.Printf("Error writing custom neovim.lua: %v", err)
			} else {
				log.Printf("Applied selected Neovim theme to %s", outputPath)
			}
			continue
		}

		// Skip templates for excluded apps (used by export filtering)
		if len(settings.ExcludedApps) > 0 {
			appName := getAppNameFromFileName(fileName)
			if settings.ExcludedApps[appName] {
				continue
			}
		}

		w.processTemplate(fileName, outputPath, variables, appOverrides, globalOverrides)
	}
}

// processTemplate reads a single template, applies variable substitution
// (including per-app overrides), and writes the result.
func (w *Writer) processTemplate(
	fileName string,
	outputPath string,
	variables map[string]string,
	appOverrides map[string]map[string]string,
	globalOverrides map[string]string,
) {
	// Check for custom override in ~/.config/aether/custom/ first
	content, isCustom := template.ReadCustomOverride(fileName)
	if !isCustom {
		var err error
		content, err = template.ReadTemplate(w.templatesFS, w.templatesDir, fileName)
		if err != nil {
			log.Printf("Error reading template %s: %v", fileName, err)
			return
		}
	}

	// Check for app-specific overrides
	appName := getAppNameFromFileName(fileName)
	mergedVars := variables
	if overrides, ok := appOverrides[appName]; ok && len(overrides) > 0 {
		// Copy base variables and apply overrides
		mergedVars = make(map[string]string, len(variables)+len(overrides))
		for k, v := range variables {
			mergedVars[k] = v
		}
		for k, v := range overrides {
			mergedVars[k] = v
		}
		// Recompute derived/alias variables so overriding "background"
		// also updates "bg", "dark_bg", etc. The "explicit" set preserves
		// both per-app overrides and globally pinned shades (already present
		// in mergedVars via variables) so neither gets recomputed away.
		// Per-app overrides are applied last so they win over a global pin.
		explicit := make(map[string]string, len(overrides)+len(globalOverrides))
		for k, v := range globalOverrides {
			explicit[k] = v
		}
		for k, v := range overrides {
			explicit[k] = v
		}
		template.RecomputeDerived(mergedVars, explicit)
		log.Printf("Applied %d override(s) to %s", len(overrides), fileName)
	}

	processed := template.ProcessTemplate(content, mergedVars)

	if err := platform.WriteText(outputPath, processed); err != nil {
		log.Printf("Error writing processed template %s: %v", fileName, err)
	}
}

// processVSCodeExtension recursively reads all files from the embedded
// vscode-extension directory, applies variable substitution, and writes
// them to destDir.
func processVSCodeExtension(fsys embed.FS, templatesDir string, destDir string, variables map[string]string) error {
	root := path.Join(templatesDir, "vscode-extension")

	return fs.WalkDir(fsys, root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Compute the relative path from the vscode-extension root.
		// Use path (not filepath) because embed.FS always uses forward slashes.
		rel := strings.TrimPrefix(strings.TrimPrefix(p, root), "/")
		if rel == "" {
			rel = "."
		}
		destPath := filepath.Join(destDir, filepath.FromSlash(rel))

		if d.IsDir() {
			return platform.EnsureDir(destPath)
		}

		// Read file from embedded FS
		data, err := fs.ReadFile(fsys, p)
		if err != nil {
			return err
		}

		// Apply variable substitution (only {key} format for VSCode extension)
		content := string(data)
		for key, value := range variables {
			content = strings.ReplaceAll(content, "{"+key+"}", value)
		}

		return platform.WriteText(destPath, content)
	})
}
