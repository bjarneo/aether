package theme

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"aether/internal/color"
	"aether/internal/omarchy"
	"aether/internal/platform"
	"aether/internal/template"
)

// templateAppNameMap maps template file names to standardised app names,
// used for per-app override lookups.
var templateAppNameMap = map[string]string{
	"alacritty.toml":    "alacritty",
	"aether.zed.json":   "zed",
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

// omarchyThemeFiles are files the current Omarchy theme loader consumes
// directly. Other application templates belong to the standalone profile.
var omarchyThemeFiles = map[string]bool{
	"alacritty.toml": true,
	"btop.theme":     true,
	"chromium.theme": true,
	"foot.ini":       true,
	"ghostty.conf":   true,
	"icons.theme":    true,
	"kitty.conf":     true,
	"neovim.lua":     true,
	"vscode.json":    true,
}

// SupportsOmarchyOverride reports whether Omarchy consumes Aether's per-theme
// file for an application.
func SupportsOmarchyOverride(app string) bool {
	return omarchy.SupportsThemeOverride(app)
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
	IncludedApps         map[string]bool `json:"includedApps,omitempty"`
	ExcludedApps         map[string]bool `json:"excludedApps,omitempty"`
}

// includesApp supports explicit opt-in targets while preserving callers that
// still use the legacy special flags and exclusion map.
func (s Settings) includesApp(app string) bool {
	if s.IncludedApps != nil {
		return s.IncludedApps[app]
	}
	if s.ExcludedApps[app] {
		return false
	}

	switch app {
	case "zed":
		return s.IncludeZed
	case "vscode":
		return s.IncludeVscode
	case "neovim":
		return s.IncludeNeovim
	default:
		return !s.ExcludedApps[app]
	}
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
			return "", fmt.Errorf("copy wallpaper: %w", err)
		}
		wallpaperDest = destPath
	}

	for i, src := range state.AdditionalImages {
		destPath := filepath.Join(bgDir, filepath.Base(src))
		if err := platform.CopyFile(src, destPath); err != nil {
			return "", fmt.Errorf("copy additional image %d: %w", i+1, err)
		}
	}

	return wallpaperDest, nil
}

// applyEditorThemes applies optional editor themes (Zed, VSCode).
func (w *Writer) applyEditorThemes(
	themeDir string,
	variables map[string]string,
	appOverrides map[string]map[string]string,
	includeZed bool,
	includeVscode bool,
) {
	if includeZed || len(appOverrides["zed"]) > 0 {
		if err := ApplyZedTheme(themeDir); err != nil {
			log.Printf("Warning: Zed theme application failed: %v", err)
		}
	}
	if includeVscode || len(appOverrides["vscode"]) > 0 {
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
	settings Settings,
	appOverrides map[string]map[string]string,
	globalOverrides map[string]string,
) error {
	if err := w.processTemplate(
		"colors.v4.toml",
		filepath.Join(themeDir, "colors.toml"),
		variables,
		appOverrides,
		globalOverrides,
	); err != nil {
		return err
	}

	names, err := template.ListTemplates(w.templatesFS, w.templatesDir)
	if err != nil {
		return fmt.Errorf("list templates: %w", err)
	}
	for _, fileName := range names {
		if fileName == "copy.json" || fileName == "colors.toml" || fileName == "colors.v4.toml" {
			continue
		}

		if !omarchyThemeFiles[fileName] {
			continue
		}

		appName := getAppNameFromFileName(fileName)
		include := fileName == "icons.theme" || len(appOverrides[appName]) > 0
		if fileName == "neovim.lua" && settings.SelectedNeovimConfig != "" {
			include = true
		}
		if !include {
			continue
		}

		outputPath := filepath.Join(themeDir, fileName)
		if fileName == "vscode.json" {
			if err := w.processOmarchyV4VSCodeTheme(themeDir, variables, appOverrides, globalOverrides); err != nil {
				return err
			}
			continue
		}
		if fileName == "neovim.lua" && settings.SelectedNeovimConfig != "" && len(appOverrides[appName]) == 0 {
			if err := platform.WriteText(outputPath, settings.SelectedNeovimConfig); err != nil {
				return fmt.Errorf("write custom neovim.lua: %w", err)
			}
			continue
		}
		if err := w.processTemplate(fileName, outputPath, variables, appOverrides, globalOverrides); err != nil {
			return err
		}
	}
	return nil
}

// GenerateOmarchyV4Only atomically writes an Aether-managed native Omarchy
// theme. Existing foreign themes are never overwritten.
func (w *Writer) GenerateOmarchyV4Only(state *ThemeState, settings Settings, outputPath string) error {
	_, err := w.generateOmarchyTheme(state, settings, outputPath)
	return err
}

func (w *Writer) generateOmarchyTheme(state *ThemeState, settings Settings, outputPath string) (string, error) {
	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	if err := validateTemplateInputs(variables, state.AppOverrides); err != nil {
		return "", err
	}
	if err := omarchy.ValidateNativeColors(state.NativeColors); err != nil {
		return "", err
	}
	for app, overrides := range state.AppOverrides {
		if len(overrides) > 0 && !omarchy.SupportsThemeOverride(app) {
			return "", fmt.Errorf("%s overrides are not supported by native Omarchy themes", app)
		}
	}

	parent := filepath.Dir(outputPath)
	if err := platform.EnsureDir(parent); err != nil {
		return "", err
	}
	if err := ensureReplaceableTheme(outputPath); err != nil {
		return "", err
	}

	staging, err := os.MkdirTemp(parent, "."+filepath.Base(outputPath)+".aether-")
	if err != nil {
		return "", fmt.Errorf("create Omarchy theme staging directory: %w", err)
	}
	defer os.RemoveAll(staging)

	if state.WallpaperPath == "" && len(state.AdditionalImages) == 0 {
		if err := preserveThemeMedia(outputPath, staging); err != nil {
			return "", err
		}
	}
	wallpaperPath, err := prepareThemeDir(staging, state)
	if err != nil {
		return "", err
	}
	if err := w.processOmarchyV4Templates(staging, variables, settings, state.AppOverrides, state.ExtendedColors); err != nil {
		return "", err
	}
	if err := appendNativeColors(filepath.Join(staging, "colors.toml"), state.NativeColors); err != nil {
		return "", err
	}
	if wallpaperPath != "" {
		if err := writeThemePreview(staging, wallpaperPath); err != nil {
			return "", err
		}
	}
	if err := omarchy.MarkManagedTheme(staging); err != nil {
		return "", fmt.Errorf("mark Omarchy theme as Aether-managed: %w", err)
	}
	if err := replaceThemeDir(staging, outputPath); err != nil {
		return "", err
	}

	if wallpaperPath == "" {
		return "", nil
	}
	return filepath.Join(outputPath, "backgrounds", filepath.Base(wallpaperPath)), nil
}

// ApplyTheme generates all theme files and applies the theme to the system.
func (w *Writer) ApplyTheme(state *ThemeState, settings Settings) (*ApplyResult, error) {
	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	if err := validateTemplateInputs(variables, state.AppOverrides); err != nil {
		return &ApplyResult{Success: false, IsOmarchy: IsOmarchyInstalled(), ThemePath: platform.ThemeDir()}, err
	}
	if err := RetireLegacyGTKStylesheets(); err != nil {
		log.Printf("Warning: legacy GTK stylesheet cleanup failed: %v", err)
	}

	isOmarchy := IsOmarchyInstalled()
	if isOmarchy {
		themeDir := platform.OmarchyThemeDir()
		wallpaperDest, err := w.generateOmarchyTheme(state, settings, themeDir)
		if err != nil {
			return &ApplyResult{Success: false, IsOmarchy: true, ThemePath: themeDir}, err
		}
		if err := omarchy.ActivateTheme("aether", wallpaperDest); err != nil {
			return &ApplyResult{Success: false, IsOmarchy: true, ThemePath: themeDir}, err
		}
		return &ApplyResult{Success: true, IsOmarchy: true, ThemePath: themeDir}, nil
	}

	themeDir := platform.ThemeDir()
	if _, err := prepareThemeDir(themeDir, state); err != nil {
		return &ApplyResult{Success: false, ThemePath: themeDir}, err
	}
	w.processTemplates(variables, themeDir, settings, state.AppOverrides, state.ExtendedColors)
	w.applyEditorThemes(
		themeDir,
		variables,
		state.AppOverrides,
		settings.includesApp("zed"),
		settings.includesApp("vscode"),
	)
	if err := HandleLightModeMarker(themeDir, state.LightMode); err != nil {
		log.Printf("Warning: light mode marker failed: %v", err)
	}
	if err := template.ProcessCustomApps(themeDir, variables); err != nil {
		log.Printf("Warning: custom app processing failed: %v", err)
	}
	return &ApplyResult{Success: true, ThemePath: themeDir}, nil
}

// GenerateOnly generates theme files to the specified output path without
// applying them (no symlinks, no service restarts, no omarchy activation).
func (w *Writer) GenerateOnly(state *ThemeState, settings Settings, outputPath string) error {
	variables := template.BuildVariables(state.ColorRoles, state.LightMode, state.ExtendedColors)
	if err := validateTemplateInputs(variables, state.AppOverrides); err != nil {
		return err
	}
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

	w.processTemplates(variables, targetDir, settings, state.AppOverrides, state.ExtendedColors)

	// Generate VSCode extension into the export directory
	vscodeDir := filepath.Join(targetDir, "vscode-extension")
	if settings.includesApp("vscode") || len(state.AppOverrides["vscode"]) > 0 {
		if err := processVSCodeExtension(w.templatesFS, w.templatesDir, vscodeDir, variables); err != nil {
			log.Printf("Warning: VSCode extension export failed: %v", err)
		}
	} else if err := os.RemoveAll(vscodeDir); err != nil {
		log.Printf("Warning: stale VSCode extension cleanup failed: %v", err)
	}

	if err := HandleLightModeMarker(targetDir, state.LightMode); err != nil {
		log.Printf("Warning: light mode marker failed: %v", err)
	}

	log.Printf("Theme files generated to: %s", targetDir)
	return nil
}

func validateTemplateInputs(variables map[string]string, appOverrides map[string]map[string]string) error {
	for key, value := range variables {
		switch key {
		case "mode", "theme_type":
			if value != "light" && value != "dark" {
				return fmt.Errorf("template variable %q has an invalid mode", key)
			}
		default:
			if !color.IsHexColor(value) {
				return fmt.Errorf("template variable %q is not a hex color", key)
			}
		}
	}
	for app, overrides := range appOverrides {
		for key, value := range overrides {
			if key == "mode" || key == "theme_type" || !color.IsHexColor(value) {
				return fmt.Errorf("%s override %q is not a hex color", app, key)
			}
		}
	}
	return nil
}

func ensureReplaceableTheme(path string) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect Omarchy theme: %w", err)
	}
	if !info.IsDir() && info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("Omarchy theme path is not a directory: %s", path)
	}
	if omarchy.IsManagedThemeDir(path) {
		return nil
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("refusing to replace unmanaged Omarchy theme %q", filepath.Base(path))
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return fmt.Errorf("inspect Omarchy theme contents: %w", err)
	}
	if len(entries) == 0 {
		return nil
	}
	return fmt.Errorf("refusing to replace unmanaged Omarchy theme %q", filepath.Base(path))
}

func preserveThemeMedia(existing, staging string) error {
	if _, err := os.Stat(existing); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("inspect existing Omarchy theme: %w", err)
	}

	sourceBackgrounds := filepath.Join(existing, "backgrounds")
	entries, err := os.ReadDir(sourceBackgrounds)
	if err == nil {
		targetBackgrounds := filepath.Join(staging, "backgrounds")
		if err := platform.EnsureDir(targetBackgrounds); err != nil {
			return err
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			if err := platform.CopyFile(
				filepath.Join(sourceBackgrounds, entry.Name()),
				filepath.Join(targetBackgrounds, entry.Name()),
			); err != nil {
				return fmt.Errorf("preserve Omarchy background %q: %w", entry.Name(), err)
			}
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read existing Omarchy backgrounds: %w", err)
	}

	for _, name := range []string{"preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.gif", "preview.bmp"} {
		source := filepath.Join(existing, name)
		if _, err := os.Stat(source); err != nil {
			continue
		}
		if err := platform.CopyFile(source, filepath.Join(staging, name)); err != nil {
			return fmt.Errorf("preserve Omarchy preview: %w", err)
		}
		break
	}
	return nil
}

func appendNativeColors(colorsPath string, native map[string]string) error {
	if len(native) == 0 {
		return nil
	}
	data, err := os.ReadFile(colorsPath)
	if err != nil {
		return fmt.Errorf("read generated Omarchy colors: %w", err)
	}
	keys := make([]string, 0, len(native))
	for key := range native {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var content strings.Builder
	content.Grow(len(data) + len(keys)*32)
	content.Write(data)
	if len(data) > 0 && data[len(data)-1] != '\n' {
		content.WriteByte('\n')
	}
	content.WriteByte('\n')
	content.WriteString("# Preserved native Omarchy values.\n")
	for _, key := range keys {
		fmt.Fprintf(&content, "%s = %q\n", key, native[key])
	}
	if err := platform.WriteText(colorsPath, content.String()); err != nil {
		return fmt.Errorf("write native Omarchy colors: %w", err)
	}
	return nil
}

func writeThemePreview(themeDir, wallpaper string) error {
	ext := strings.ToLower(filepath.Ext(wallpaper))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp":
	default:
		ext = ".png"
	}
	if err := platform.CopyFile(wallpaper, filepath.Join(themeDir, "preview"+ext)); err != nil {
		return fmt.Errorf("write Omarchy theme preview: %w", err)
	}
	return nil
}

func replaceThemeDir(staging, target string) error {
	if _, err := os.Lstat(target); os.IsNotExist(err) {
		if err := os.Rename(staging, target); err != nil {
			return fmt.Errorf("install Omarchy theme: %w", err)
		}
		return nil
	} else if err != nil {
		return fmt.Errorf("inspect Omarchy theme target: %w", err)
	}

	backup, err := os.MkdirTemp(filepath.Dir(target), "."+filepath.Base(target)+".backup-")
	if err != nil {
		return fmt.Errorf("reserve Omarchy theme backup: %w", err)
	}
	if err := os.Remove(backup); err != nil {
		return fmt.Errorf("prepare Omarchy theme backup: %w", err)
	}
	if err := os.Rename(target, backup); err != nil {
		return fmt.Errorf("backup Omarchy theme: %w", err)
	}
	restore := func(cause error) error {
		if err := os.Rename(backup, target); err != nil {
			return fmt.Errorf("%w; restore backup from %s: %v", cause, backup, err)
		}
		return cause
	}
	if err := ensureReplaceableTheme(backup); err != nil {
		return restore(fmt.Errorf("Omarchy theme changed during generation: %w", err))
	}
	if err := os.Rename(staging, target); err != nil {
		return restore(fmt.Errorf("install Omarchy theme: %w", err))
	}
	if err := os.RemoveAll(backup); err != nil {
		log.Printf("Warning: could not remove Omarchy theme backup: %v", err)
	}
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

		outputPath := filepath.Join(outputDir, fileName)
		appName := getAppNameFromFileName(fileName)
		if appName != "colors" && !settings.includesApp(appName) && len(appOverrides[appName]) == 0 {
			if err := os.Remove(outputPath); err != nil && !os.IsNotExist(err) {
				log.Printf("Error removing stale template %s: %v", fileName, err)
			}
			continue
		}

		// Handle neovim.lua with custom config selection
		if fileName == "neovim.lua" && settings.SelectedNeovimConfig != "" && len(appOverrides[appName]) == 0 {
			if err := platform.WriteText(outputPath, settings.SelectedNeovimConfig); err != nil {
				log.Printf("Error writing custom neovim.lua: %v", err)
			} else {
				log.Printf("Applied selected Neovim theme to %s", outputPath)
			}
			continue
		}

		if err := w.processTemplate(fileName, outputPath, variables, appOverrides, globalOverrides); err != nil {
			log.Printf("Error processing template %s: %v", fileName, err)
		}
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
) error {
	// Check for custom override in ~/.config/aether/custom/ first
	content, isCustom := template.ReadCustomOverride(fileName)
	if !isCustom {
		var err error
		content, err = template.ReadTemplate(w.templatesFS, w.templatesDir, fileName)
		if err != nil {
			return fmt.Errorf("read template %s: %w", fileName, err)
		}
	}

	// Check for app-specific overrides
	appName := getAppNameFromFileName(fileName)
	overrides := appOverrides[appName]
	mergedVars := mergeTemplateVariables(variables, overrides, globalOverrides)
	if len(overrides) > 0 {
		log.Printf("Applied %d override(s) to %s", len(overrides), fileName)
	}

	processed := template.ProcessTemplate(content, mergedVars)

	if err := platform.WriteText(outputPath, processed); err != nil {
		return fmt.Errorf("write processed template %s: %w", fileName, err)
	}
	return nil
}

func (w *Writer) processOmarchyV4VSCodeTheme(
	themeDir string,
	variables map[string]string,
	appOverrides map[string]map[string]string,
	globalOverrides map[string]string,
) error {
	templatePath := path.Join(w.templatesDir, "vscode-extension/themes/aether-color-theme.json")
	content, err := fs.ReadFile(w.templatesFS, templatePath)
	if err != nil {
		return fmt.Errorf("read VSCode theme template: %w", err)
	}

	mergedVars := mergeTemplateVariables(variables, appOverrides["vscode"], globalOverrides)
	processed := template.ProcessTemplate(string(content), mergedVars)
	if err := platform.WriteText(filepath.Join(themeDir, "vscode-theme.json"), processed); err != nil {
		return fmt.Errorf("write processed VSCode theme: %w", err)
	}
	return nil
}

func mergeTemplateVariables(
	variables map[string]string,
	overrides map[string]string,
	globalOverrides map[string]string,
) map[string]string {
	if len(overrides) == 0 {
		return variables
	}

	merged := make(map[string]string, len(variables)+len(overrides))
	for k, v := range variables {
		merged[k] = v
	}
	for k, v := range overrides {
		merged[k] = v
	}

	// Recompute aliases and derived colors while preserving explicit pins.
	explicit := make(map[string]string, len(overrides)+len(globalOverrides))
	for k, v := range globalOverrides {
		explicit[k] = v
	}
	for k, v := range overrides {
		explicit[k] = v
	}
	template.RecomputeDerived(merged, explicit)
	return merged
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
