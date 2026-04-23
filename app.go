package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"aether/internal/batch"
	"aether/internal/blueprint"
	"aether/internal/color"
	"aether/internal/extraction"
	"aether/internal/favorites"
	"aether/internal/omarchy"
	"aether/internal/platform"
	"aether/internal/template"
	"aether/internal/theme"
	"aether/internal/wallhaven"
	"aether/internal/wallpaper"
	"aether/ipc"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main Wails application struct.
// All exported methods are automatically bound as frontend API.
type App struct {
	ctx          context.Context
	state        *theme.ThemeState
	history      *theme.HistoryManager
	writer       *theme.Writer
	blueprints   *blueprint.Service
	favorites    *favorites.Service
	wallhaven    *wallhaven.Client
	batch        *batch.Processor
	themeWatcher *theme.ThemeWatcher
	media        *MediaServer
	ipcServer    *ipc.Server
	widgetMode   bool
	sliderWidget bool
	themesSlider bool
	focusTab     string
}

// IsWidgetMode returns true when running in --widget-blueprint mode.
func (a *App) IsWidgetMode() bool { return a.widgetMode }

// IsSliderWidget returns true when running in --widget-wallpaper-slider mode.
func (a *App) IsSliderWidget() bool { return a.sliderWidget }

// IsThemesSlider returns true when running in --widget-themes-slider mode.
func (a *App) IsThemesSlider() bool { return a.themesSlider }

// IsMacOS returns true when running on macOS.
func (a *App) IsMacOS() bool { return runtime.GOOS == "darwin" }

// GetFocusTab returns the tab to focus on startup (empty = default editor).
func (a *App) GetFocusTab() string { return a.focusTab }

// GetThemeColors returns the current parsed colors.toml map. Frontend
// pulls this on mount; the event-emit race means push alone isn't safe.
func (a *App) GetThemeColors() map[string]string {
	return a.themeWatcher.CurrentColors()
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{
		state:        theme.NewThemeState(),
		history:      theme.NewHistoryManager(),
		writer:       theme.NewWriter(EmbeddedTemplates, "templates"),
		blueprints:   blueprint.NewService(),
		favorites:    favorites.NewService(),
		wallhaven:    wallhaven.NewClient(),
		batch:        batch.NewProcessor(),
		themeWatcher: theme.NewThemeWatcher(),
	}
}

// startup is called by Wails when the application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = platform.EnsureAllDirs()
	a.themeWatcher.Start(ctx)

	a.media = &MediaServer{}
	if err := a.media.Start(); err != nil {
		log.Printf("media server: %v", err)
	}

	// Start IPC server for remote control
	srv, err := ipc.NewServer(ipc.DefaultSocketPath(), a)
	if err != nil {
		log.Printf("ipc: %v", err)
	} else {
		a.ipcServer = srv
	}
}

// CloseIPC shuts down the IPC server. Called on app exit.
func (a *App) CloseIPC() {
	if a.ipcServer != nil {
		a.ipcServer.Close()
	}
}

// GetMediaURL returns an http://localhost URL for streaming a local media file.
// Used by the frontend for <video> elements since webkit2gtk's GStreamer backend
// cannot fetch from the custom wails:// scheme.
func (a *App) GetMediaURL(path string) string {
	return a.media.URL(path)
}

// ---------------------------------------------------------------------------
// Color Extraction
// ---------------------------------------------------------------------------

// ExtractColors extracts a 16-color ANSI palette from an image or video.
// For video files, a frame is extracted first via ffmpeg.
func (a *App) ExtractColors(path string, lightMode bool, mode string) ([16]string, error) {
	if theme.IsVideoFile(path) {
		framePath, err := wallpaper.ExtractVideoFrame(path)
		if err != nil {
			return [16]string{}, fmt.Errorf("video frame extraction failed: %w", err)
		}
		path = framePath
	}
	palette, err := extraction.ExtractColors(path, lightMode, mode)
	if err != nil {
		return palette, err
	}
	a.state.SetPalette(palette)
	a.state.WallpaperPath = path
	a.state.LightMode = lightMode
	a.state.ExtractionMode = mode
	return palette, nil
}

// ExtractFromImagesResult is the Wails-friendly return value for ExtractColorsFromImages.
type ExtractFromImagesResult struct {
	Palette [16]string `json:"palette"`
	Skipped int        `json:"skipped"`
}

// ExtractColorsFromImages extracts a blended 16-color palette by sampling pixels
// from multiple images (typically the main wallpaper plus additional images) and
// running the OKLab median-cut pipeline on the combined pixel set. Video paths are
// resolved to extracted frames before sampling; unreadable or unsupported files
// are skipped and counted in the result.
func (a *App) ExtractColorsFromImages(paths []string, lightMode bool, mode string) (ExtractFromImagesResult, error) {
	resolved := make([]string, 0, len(paths))
	skipped := 0
	for _, p := range paths {
		if p == "" {
			skipped++
			continue
		}
		if theme.IsVideoFile(p) {
			framePath, err := wallpaper.ExtractVideoFrame(p)
			if err != nil {
				skipped++
				continue
			}
			resolved = append(resolved, framePath)
			continue
		}
		resolved = append(resolved, p)
	}

	palette, extractionSkipped, err := extraction.ExtractColorsFromImages(resolved, lightMode, mode)
	if err != nil {
		return ExtractFromImagesResult{}, err
	}
	a.state.SetPalette(palette)
	a.state.LightMode = lightMode
	a.state.ExtractionMode = mode
	return ExtractFromImagesResult{
		Palette: palette,
		Skipped: skipped + extractionSkipped,
	}, nil
}

// AdjustPaletteColors applies the adjustment pipeline to all palette colors.
// Uses []string (slice) instead of [16]string for Wails JSON compatibility.
func (a *App) AdjustPaletteColors(palette []string, adj color.Adjustments) []string {
	result := make([]string, len(palette))
	for i, hex := range palette {
		if hex != "" {
			result[i] = color.AdjustColor(hex, adj)
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// Theme State
// ---------------------------------------------------------------------------

// SetExtractionMode sets the palette extraction mode.
func (a *App) SetExtractionMode(mode string) {
	a.state.ExtractionMode = mode
}

// SyncStateRequest mirrors the frontend editor state into Go so IPC readers
// (`aether status`, etc.) reflect live edits without requiring Apply.
type SyncStateRequest struct {
	Palette          []string                     `json:"palette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
	AdditionalImages []string                     `json:"additionalImages"`
}

// SyncState is called (debounced) by the frontend whenever the editor state
// changes. Uses SetAdjustedPalette so BasePalette from the last extraction
// is preserved as the "pristine" reference.
func (a *App) SyncState(req SyncStateRequest) {
	if len(req.Palette) >= 16 {
		var p [16]string
		for i := 0; i < 16; i++ {
			p[i] = req.Palette[i]
		}
		a.state.SetAdjustedPalette(p)
	}
	a.state.WallpaperPath = req.WallpaperPath
	a.state.LightMode = req.LightMode
	if req.ExtendedColors != nil {
		a.state.ExtendedColors = req.ExtendedColors
	}
	if req.AppOverrides != nil {
		a.state.AppOverrides = req.AppOverrides
	}
	if req.AdditionalImages != nil {
		a.state.AdditionalImages = req.AdditionalImages
	}
}

// ComputeVariables builds the full template variable map from the given
// palette and extended colors. Returns all base + derived color values.
func (a *App) ComputeVariables(paletteSlice []string, extendedColors map[string]string, lightMode bool) map[string]string {
	var palette [16]string
	for i := 0; i < 16 && i < len(paletteSlice); i++ {
		palette[i] = paletteSlice[i]
	}

	accent, cursor, selFg, selBg := palette[4], palette[7], palette[0], palette[7]
	if v := extendedColors["accent"]; v != "" {
		accent = v
	}
	if v := extendedColors["cursor"]; v != "" {
		cursor = v
	}
	if v := extendedColors["selection_foreground"]; v != "" {
		selFg = v
	}
	if v := extendedColors["selection_background"]; v != "" {
		selBg = v
	}

	roles := template.ColorRoles{
		Background: palette[0], Foreground: palette[7],
		Black: palette[0], Red: palette[1], Green: palette[2], Yellow: palette[3],
		Blue: palette[4], Magenta: palette[5], Cyan: palette[6], White: palette[7],
		BrightBlack: palette[8], BrightRed: palette[9], BrightGreen: palette[10],
		BrightYellow: palette[11], BrightBlue: palette[12], BrightMagenta: palette[13],
		BrightCyan: palette[14], BrightWhite: palette[15],
		Accent: accent, Cursor: cursor,
		SelectionForeground: selFg, SelectionBackground: selBg,
	}

	return template.BuildVariables(roles, lightMode)
}

// ---------------------------------------------------------------------------
// Theme Application
// ---------------------------------------------------------------------------

// ApplyThemeRequest is the payload from the frontend containing all current state.
type ApplyThemeRequest struct {
	Palette          []string                     `json:"palette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	AdditionalImages []string                     `json:"additionalImages"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	Settings         theme.Settings               `json:"settings"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
}

// ApplyTheme processes all templates and applies the theme to the system.
func (a *App) ApplyTheme(req ApplyThemeRequest) (*theme.ApplyResult, error) {
	var palette [16]string
	for i := 0; i < 16 && i < len(req.Palette); i++ {
		palette[i] = req.Palette[i]
	}

	// Use extended colors if provided, otherwise derive from palette
	accent := palette[4]
	cursor := palette[7]
	selFg := palette[0]
	selBg := palette[7]
	if v, ok := req.ExtendedColors["accent"]; ok && v != "" {
		accent = v
	}
	if v, ok := req.ExtendedColors["cursor"]; ok && v != "" {
		cursor = v
	}
	if v, ok := req.ExtendedColors["selection_foreground"]; ok && v != "" {
		selFg = v
	}
	if v, ok := req.ExtendedColors["selection_background"]; ok && v != "" {
		selBg = v
	}

	roles := template.ColorRoles{
		Background: palette[0], Foreground: palette[7],
		Black: palette[0], Red: palette[1], Green: palette[2], Yellow: palette[3],
		Blue: palette[4], Magenta: palette[5], Cyan: palette[6], White: palette[7],
		BrightBlack: palette[8], BrightRed: palette[9], BrightGreen: palette[10],
		BrightYellow: palette[11], BrightBlue: palette[12], BrightMagenta: palette[13],
		BrightCyan: palette[14], BrightWhite: palette[15],
		Accent: accent, Cursor: cursor,
		SelectionForeground: selFg, SelectionBackground: selBg,
	}

	appOverrides := req.AppOverrides
	if appOverrides == nil {
		appOverrides = make(map[string]map[string]string)
	}

	state := &theme.ThemeState{
		Palette:          palette,
		WallpaperPath:    req.WallpaperPath,
		LightMode:        req.LightMode,
		ColorRoles:       roles,
		AdditionalImages: req.AdditionalImages,
		AppOverrides:     appOverrides,
	}

	return a.writer.ApplyTheme(state, req.Settings)
}

// ClearTheme removes the Aether theme and reverts to the default.
func (a *App) ClearTheme() error {
	return theme.ClearTheme()
}

// ---------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------

// ListBlueprints returns all saved blueprints.
func (a *App) ListBlueprints() ([]map[string]interface{}, error) {
	bps, err := a.blueprints.LoadAll()
	if err != nil {
		return nil, err
	}
	// Convert to raw maps to avoid Wails model conversion issues
	result := make([]map[string]interface{}, len(bps))
	for i, bp := range bps {
		result[i] = map[string]interface{}{
			"name":      bp.Name,
			"timestamp": bp.Timestamp,
			"palette": map[string]interface{}{
				"colors":           bp.Palette.Colors,
				"wallpaper":        bp.Palette.Wallpaper,
				"lightMode":        bp.Palette.LightMode,
				"additionalImages": bp.Palette.AdditionalImages,
			},
			"adjustments":  bp.Adjustments,
			"appOverrides": bp.AppOverrides,
		}
	}
	return result, nil
}

// SaveBlueprint saves the current state as a named blueprint.
// SaveBlueprintRequest contains all state needed to save a blueprint.
type SaveBlueprintRequest struct {
	Name             string                       `json:"name"`
	Palette          []string                     `json:"palette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	AdditionalImages []string                     `json:"additionalImages"`
	LockedColors     []int                        `json:"lockedColors"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
	Adjustments      map[string]float64           `json:"adjustments"`
}

func (a *App) SaveBlueprint(req SaveBlueprintRequest) error {
	bp := blueprint.Blueprint{
		Palette: blueprint.PaletteData{
			Colors:           req.Palette,
			Wallpaper:        req.WallpaperPath,
			LightMode:        req.LightMode,
			AdditionalImages: req.AdditionalImages,
			LockedColors:     req.LockedColors,
			ExtendedColors:   req.ExtendedColors,
		},
		Adjustments:  req.Adjustments,
		AppOverrides: req.AppOverrides,
	}
	return a.blueprints.Save(req.Name, bp)
}

// resolveWallpaper returns a local wallpaper path from a blueprint. If the local
// path exists it is returned directly. Otherwise, if a URL is available, the
// wallpaper is downloaded first.
func (a *App) resolveWallpaper(palette blueprint.PaletteData) string {
	// Use local path if it exists.
	if palette.Wallpaper != "" && platform.FileExists(palette.Wallpaper) {
		return palette.Wallpaper
	}

	// Try downloading from URL.
	if palette.WallpaperURL != "" {
		localPath, err := a.wallhaven.DownloadFromURL(palette.WallpaperURL)
		if err != nil {
			log.Printf("Warning: could not download wallpaper from %s: %v", palette.WallpaperURL, err)
			return ""
		}
		log.Printf("Downloaded wallpaper: %s", localPath)
		return localPath
	}

	return ""
}

// LoadBlueprint loads a blueprint by name into the current state.
func (a *App) LoadBlueprint(name string) error {
	bp, err := a.blueprints.FindByName(name)
	if err != nil {
		return err
	}
	if bp == nil {
		return fmt.Errorf("blueprint %q not found", name)
	}

	a.history.Push(*a.state)

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}
	a.state.SetPalette(palette)
	a.state.WallpaperPath = a.resolveWallpaper(bp.Palette)
	a.state.LightMode = bp.Palette.LightMode
	if bp.Palette.AdditionalImages != nil {
		a.state.AdditionalImages = bp.Palette.AdditionalImages
	} else {
		a.state.AdditionalImages = []string{}
	}
	a.state.Adjustments = a.adjustmentsFromBlueprint(bp)
	a.state.AppOverrides = a.appOverridesFromBlueprint(bp)
	return nil
}

// ApplyBlueprint loads a blueprint by name and applies it as the active theme.
func (a *App) ApplyBlueprint(name string) (*theme.ApplyResult, error) {
	bp, err := a.blueprints.FindByName(name)
	if err != nil {
		return nil, err
	}
	if bp == nil {
		return nil, fmt.Errorf("blueprint %q not found", name)
	}

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}

	a.state.SetPalette(palette)
	a.state.WallpaperPath = a.resolveWallpaper(bp.Palette)
	a.state.LightMode = bp.Palette.LightMode
	if bp.Palette.AdditionalImages != nil {
		a.state.AdditionalImages = bp.Palette.AdditionalImages
	} else {
		a.state.AdditionalImages = []string{}
	}
	a.state.Adjustments = a.adjustmentsFromBlueprint(bp)
	a.state.AppOverrides = a.appOverridesFromBlueprint(bp)

	return a.writer.ApplyTheme(a.state, theme.Settings{})
}

// BlueprintExists checks whether a blueprint with the given name already exists.
func (a *App) BlueprintExists(name string) bool {
	bp, _ := a.blueprints.FindByName(name)
	return bp != nil
}

// DeleteBlueprint removes a blueprint by name.
func (a *App) DeleteBlueprint(name string) error {
	return a.blueprints.Delete(name)
}

// adjustmentsFromBlueprint converts a blueprint's stored adjustments map to a
// typed Adjustments struct, falling back to defaults when the blueprint has none.
func (a *App) adjustmentsFromBlueprint(bp *blueprint.Blueprint) color.Adjustments {
	adj := color.DefaultAdjustments()
	if len(bp.Adjustments) == 0 {
		return adj
	}
	data, err := json.Marshal(bp.Adjustments)
	if err != nil {
		return adj
	}
	_ = json.Unmarshal(data, &adj)
	return adj
}

// appOverridesFromBlueprint returns a deep copy of the blueprint's app overrides
// or an empty map. A copy is needed to avoid aliasing the blueprint's data.
func (a *App) appOverridesFromBlueprint(bp *blueprint.Blueprint) map[string]map[string]string {
	result := make(map[string]map[string]string, len(bp.AppOverrides))
	for app, roles := range bp.AppOverrides {
		m := make(map[string]string, len(roles))
		for k, v := range roles {
			m[k] = v
		}
		result[app] = m
	}
	return result
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

// GetFavorites returns all favorited wallpapers.
func (a *App) GetFavorites() []favorites.Favorite {
	return a.favorites.GetAll()
}

// ToggleFavorite adds or removes a favorite. Returns true if now favorited.
func (a *App) ToggleFavorite(path, favType string, data map[string]interface{}) bool {
	return a.favorites.Toggle(path, favType, data)
}

// IsFavorite checks if a path is favorited.
func (a *App) IsFavorite(path string) bool {
	return a.favorites.IsFavorite(path)
}

// ---------------------------------------------------------------------------
// App Settings (template toggles, neovim config)
// ---------------------------------------------------------------------------

// GetSettings reads saved app settings from ~/.config/aether/settings.json.
func (a *App) GetSettings() map[string]interface{} {
	return readConfigJSON("settings.json")
}

// SaveSettings writes app settings to ~/.config/aether/settings.json.
func (a *App) SaveSettings(config map[string]interface{}) error {
	return writeConfigJSON("settings.json", config)
}

// ---------------------------------------------------------------------------
// Wallpaper Tags
// ---------------------------------------------------------------------------

// GetWallpaperTags reads wallpaper tags from ~/.config/aether/tags.json.
func (a *App) GetWallpaperTags() map[string]interface{} {
	return readConfigJSON("tags.json")
}

// SaveWallpaperTags writes wallpaper tags to ~/.config/aether/tags.json.
func (a *App) SaveWallpaperTags(tags map[string]interface{}) error {
	return writeConfigJSON("tags.json", tags)
}

// ---------------------------------------------------------------------------
// Color Utilities
// ---------------------------------------------------------------------------

// GenerateGradient generates a 16-step gradient between two colors.
func (a *App) GenerateGradient(start, end string) [16]string {
	return color.GenerateGradient(start, end)
}

// GeneratePaletteFromColor generates a full palette from a single color.
func (a *App) GeneratePaletteFromColor(baseColor string) [16]string {
	return color.GeneratePaletteFromColor(baseColor)
}

// ContrastRatio calculates the WCAG contrast ratio between two colors.
func (a *App) ContrastRatio(hex1, hex2 string) float64 {
	return color.ContrastRatio(hex1, hex2)
}

// ---------------------------------------------------------------------------
// Wallhaven
// ---------------------------------------------------------------------------

// SetWallhavenAPIKey sets the wallhaven API key for authenticated requests.
func (a *App) SetWallhavenAPIKey(key string) {
	a.wallhaven.SetAPIKey(key)
}

// GetWallhavenConfig reads the saved wallhaven settings from ~/.config/aether/wallhaven.json.
func (a *App) GetWallhavenConfig() map[string]interface{} {
	return readConfigJSON("wallhaven.json")
}

// SaveWallhavenConfig writes wallhaven settings to ~/.config/aether/wallhaven.json.
func (a *App) SaveWallhavenConfig(config map[string]interface{}) error {
	return writeConfigJSON("wallhaven.json", config)
}

// SearchWallhaven searches wallhaven.cc for wallpapers.
func (a *App) SearchWallhaven(params wallhaven.SearchParams) (*wallhaven.SearchResult, error) {
	return a.wallhaven.SearchMultiPage(params, 2)
}

// DownloadWallpaper downloads a wallpaper from a URL. Returns local path.
func (a *App) DownloadWallpaper(imageURL string) (string, error) {
	return a.wallhaven.Download(imageURL)
}

// ---------------------------------------------------------------------------
// Local Wallpapers
// ---------------------------------------------------------------------------

// ScanLocalWallpapers scans default directories for local wallpaper images.
func (a *App) ScanLocalWallpapers() ([]wallpaper.WallpaperInfo, error) {
	return wallpaper.ScanDefaultDirs()
}

// GetThumbnail returns a thumbnail path for an image.
func (a *App) GetThumbnail(path string) (string, error) {
	return wallpaper.GetThumbnail(path)
}

// GetPreview returns an 800px preview path for the slider widget.
func (a *App) GetPreview(path string) (string, error) {
	return wallpaper.GetPreview(path)
}

// IsPreviewCached returns true if an 800px preview already exists and is fresh.
func (a *App) IsPreviewCached(path string) bool {
	return wallpaper.IsPreviewCached(path)
}

// ---------------------------------------------------------------------------
// Omarchy Themes
// ---------------------------------------------------------------------------

// LoadOmarchyThemes discovers all installed Omarchy themes.
func (a *App) LoadOmarchyThemes() ([]omarchy.Theme, error) {
	return omarchy.LoadAllThemes()
}

// ApplyOmarchyThemeByName activates an existing Omarchy theme directly
// by running "omarchy-theme-set <name>" without processing through Aether templates.
func (a *App) ApplyOmarchyThemeByName(name string) error {
	_, err := platform.RunSync("omarchy-theme-set", name)
	return err
}

// IsOmarchyInstalled returns true if the current system has Omarchy.
func (a *App) IsOmarchyInstalled() bool {
	return theme.IsOmarchyInstalled()
}

// IsAetherWpAvailable returns true if the aether-wp binary is available for animated wallpapers.
func (a *App) IsAetherWpAvailable() bool {
	return theme.IsAetherWpAvailable()
}

// ---------------------------------------------------------------------------
// Batch Processing
// ---------------------------------------------------------------------------

// StartBatchProcessing begins batch color extraction.
func (a *App) StartBatchProcessing(paths []string, lightMode bool) {
	a.batch.Start(a.ctx, paths, lightMode)
}

// CancelBatchProcessing stops the current batch.
func (a *App) CancelBatchProcessing() {
	a.batch.Cancel()
}

// ---------------------------------------------------------------------------
// File / Image Utilities
// ---------------------------------------------------------------------------

// ReadImageAsDataURL reads a local image or video file and returns it as a base64 data URL.
// This is needed because webkit2gtk cannot load file:// paths directly.
func (a *App) ReadImageAsDataURL(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}

	// Detect MIME type from extension
	ext := strings.ToLower(filepath.Ext(path))
	mime := "image/jpeg"
	switch ext {
	case ".png":
		mime = "image/png"
	case ".gif":
		mime = "image/gif"
	case ".webp":
		mime = "image/webp"
	case ".bmp":
		mime = "image/bmp"
	case ".svg":
		mime = "image/svg+xml"
	case ".mp4":
		mime = "video/mp4"
	case ".webm":
		mime = "video/webm"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
}

// SaveDataURLToFile saves a base64 data URL as a file.
// Returns the saved file path.
func (a *App) SaveDataURLToFile(dataURL string, originalPath string) (string, error) {
	// Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid data URL")
	}

	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("base64 decode failed: %w", err)
	}

	// Determine extension from the data URL mime type
	ext := ".jpg"
	if strings.Contains(parts[0], "image/png") {
		ext = ".png"
	}

	// Save to cache dir with a unique name based on original
	cacheDir := filepath.Join(platform.CacheDir(), "filtered")
	_ = platform.EnsureDir(cacheDir)

	baseName := strings.TrimSuffix(filepath.Base(originalPath), filepath.Ext(originalPath))
	outPath := filepath.Join(cacheDir, baseName+"_filtered"+ext)

	if err := os.WriteFile(outPath, decoded, 0644); err != nil {
		return "", fmt.Errorf("write file failed: %w", err)
	}

	log.Printf("[canvas-export] Saved filtered image: %s (%d bytes)", outPath, len(decoded))
	return outPath, nil
}

// OpenFileDialog opens a native file dialog for selecting an image.
// Returns the selected file path or empty string if cancelled.
func (a *App) OpenFileDialog() (string, error) {
	path, err := wailsrt.OpenFileDialog(a.ctx, wailsrt.OpenDialogOptions{
		Title: "Select Wallpaper",
		Filters: []wailsrt.FileFilter{
			{
				DisplayName: "Images & Videos",
				Pattern:     "*.jpg;*.jpeg;*.png;*.gif;*.webp;*.bmp;*.mp4;*.webm",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

// HandleDroppedFiles processes file paths from drag-and-drop.
// Takes the first image file from the dropped list.
// Returns the file path if valid, error otherwise.
func (a *App) HandleDroppedFiles(paths []string) (string, error) {
	validExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".gif": true, ".webp": true, ".bmp": true,
		".mp4": true, ".webm": true,
	}

	for _, path := range paths {
		ext := strings.ToLower(filepath.Ext(path))
		if validExts[ext] {
			return path, nil
		}
	}
	return "", fmt.Errorf("no valid image files in drop")
}

// ---------------------------------------------------------------------------
// Export / Import via GUI dialogs
// ---------------------------------------------------------------------------

// ExportThemeRequest is the payload from the frontend for exporting a theme.
type ExportThemeRequest struct {
	Name             string                       `json:"name"`
	IncludedApps     []string                     `json:"includedApps"`
	Palette          []string                     `json:"palette"`
	WallpaperPath    string                       `json:"wallpaperPath"`
	LightMode        bool                         `json:"lightMode"`
	AdditionalImages []string                     `json:"additionalImages"`
	ExtendedColors   map[string]string            `json:"extendedColors"`
	InstallToOmarchy bool                         `json:"installToOmarchy"`
	AppOverrides     map[string]map[string]string `json:"appOverrides"`
}

// allExportableApps is the full set of app names that can be exported.
var allExportableApps = map[string]bool{
	"alacritty": true, "btop": true, "chromium": true, "colors": true,
	"ghostty": true, "gtk": true, "hyprland": true, "hyprlock": true,
	"icons": true, "kitty": true, "mako": true, "neovim": true,
	"swayosd": true, "vencord": true, "vscode": true, "walker": true,
	"warp": true, "waybar": true, "wofi": true, "zed": true,
}

// ExportTheme exports the current theme to a user-chosen directory.
func (a *App) ExportTheme(req ExportThemeRequest) (string, error) {
	dir, err := wailsrt.OpenDirectoryDialog(a.ctx, wailsrt.OpenDialogOptions{
		Title: "Choose Export Directory",
	})
	if err != nil || dir == "" {
		return "", fmt.Errorf("export cancelled")
	}

	// Build theme state from the frontend's current palette
	var palette [16]string
	for i := 0; i < 16 && i < len(req.Palette); i++ {
		palette[i] = req.Palette[i]
	}

	accent := palette[4]
	cursor := palette[7]
	selFg := palette[0]
	selBg := palette[7]
	if v, ok := req.ExtendedColors["accent"]; ok && v != "" {
		accent = v
	}
	if v, ok := req.ExtendedColors["cursor"]; ok && v != "" {
		cursor = v
	}
	if v, ok := req.ExtendedColors["selection_foreground"]; ok && v != "" {
		selFg = v
	}
	if v, ok := req.ExtendedColors["selection_background"]; ok && v != "" {
		selBg = v
	}

	roles := template.ColorRoles{
		Background: palette[0], Foreground: palette[7],
		Black: palette[0], Red: palette[1], Green: palette[2], Yellow: palette[3],
		Blue: palette[4], Magenta: palette[5], Cyan: palette[6], White: palette[7],
		BrightBlack: palette[8], BrightRed: palette[9], BrightGreen: palette[10],
		BrightYellow: palette[11], BrightBlue: palette[12], BrightMagenta: palette[13],
		BrightCyan: palette[14], BrightWhite: palette[15],
		Accent: accent, Cursor: cursor,
		SelectionForeground: selFg, SelectionBackground: selBg,
	}

	exportOverrides := req.AppOverrides
	if exportOverrides == nil {
		exportOverrides = make(map[string]map[string]string)
	}

	state := &theme.ThemeState{
		Palette:          palette,
		WallpaperPath:    req.WallpaperPath,
		LightMode:        req.LightMode,
		ColorRoles:       roles,
		AdditionalImages: req.AdditionalImages,
		AppOverrides:     exportOverrides,
	}

	// Build included set from the request
	included := make(map[string]bool, len(req.IncludedApps))
	for _, app := range req.IncludedApps {
		included[app] = true
	}

	// Derive excluded apps: everything in allExportableApps that is NOT included
	excluded := make(map[string]bool)
	for app := range allExportableApps {
		if !included[app] {
			excluded[app] = true
		}
	}

	settings := theme.Settings{
		IncludeGtk:    included["gtk"],
		IncludeZed:    included["zed"],
		IncludeVscode: included["vscode"],
		IncludeNeovim: included["neovim"],
		ExcludedApps:  excluded,
	}

	exportDir := filepath.Join(dir, "omarchy-"+req.Name+"-theme")
	if err := a.writer.GenerateOnly(state, settings, exportDir); err != nil {
		return "", fmt.Errorf("export failed: %w", err)
	}

	if req.InstallToOmarchy && theme.IsOmarchyInstalled() {
		linkPath := filepath.Join(platform.OmarchyThemesDir(), req.Name)
		if err := platform.CreateSymlink(exportDir, linkPath); err != nil {
			log.Printf("Warning: could not symlink to omarchy themes: %v", err)
		} else {
			log.Printf("Installed as omarchy theme: %s -> %s", linkPath, exportDir)
		}
	}

	return exportDir, nil
}

// ImportResult is returned by ImportFileDialog with the imported colors.
type ImportResult struct {
	Colors        []string `json:"colors"`
	Name          string   `json:"name"`
	Path          string   `json:"path"`
	WallpaperPath string   `json:"wallpaperPath"`
	LightMode     bool     `json:"lightMode"`
}

// ImportFileDialog opens a file dialog for importing a theme file.
// fileType: "base16", "toml", or "blueprint"
// Returns the imported colors so the frontend can update its store.
func (a *App) ImportFileDialog(fileType string) (*ImportResult, error) {
	var filters []wailsrt.FileFilter
	var title string

	switch fileType {
	case "base16":
		title = "Import Base16 Scheme"
		filters = []wailsrt.FileFilter{
			{DisplayName: "YAML Files", Pattern: "*.yaml"},
			{DisplayName: "YML Files", Pattern: "*.yml"},
			{DisplayName: "All Files", Pattern: "*"},
		}
	case "toml":
		title = "Import Colors TOML"
		filters = []wailsrt.FileFilter{
			{DisplayName: "TOML Files", Pattern: "*.toml"},
			{DisplayName: "All Files", Pattern: "*"},
		}
	case "blueprint":
		title = "Import Blueprint"
		filters = []wailsrt.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
			{DisplayName: "All Files", Pattern: "*"},
		}
	default:
		return nil, fmt.Errorf("unknown file type: %s", fileType)
	}

	path, err := wailsrt.OpenFileDialog(a.ctx, wailsrt.OpenDialogOptions{
		Title:   title,
		Filters: filters,
	})
	if err != nil {
		log.Printf("[import] dialog error: %v", err)
		return nil, fmt.Errorf("dialog error: %w", err)
	}
	if path == "" {
		return nil, fmt.Errorf("cancelled")
	}

	log.Printf("[import] selected file: %s (type=%s)", path, fileType)
	return a.importFile(path, fileType)
}

func (a *App) importFile(path, fileType string) (*ImportResult, error) {
	var bp *blueprint.Blueprint
	var err error

	switch fileType {
	case "base16":
		bp, err = blueprint.ImportBase16(path)
	case "toml":
		bp, err = blueprint.ImportColorsToml(path)
	case "blueprint":
		bp, err = blueprint.ImportJSON(path)
	default:
		return nil, fmt.Errorf("unknown type: %s", fileType)
	}

	if err != nil {
		log.Printf("[import] parse error: %v", err)
		return nil, fmt.Errorf("parse error: %w", err)
	}

	savedPath, err := blueprint.SaveImported(bp)
	if err != nil {
		log.Printf("[import] save error: %v", err)
		return nil, fmt.Errorf("save error: %w", err)
	}

	var palette [16]string
	for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
		palette[i] = bp.Palette.Colors[i]
	}
	a.history.Push(*a.state)
	a.state.SetPalette(palette)
	a.state.WallpaperPath = a.resolveWallpaper(bp.Palette)
	a.state.LightMode = bp.Palette.LightMode

	log.Printf("[import] success: %s (%d colors)", bp.Name, len(bp.Palette.Colors))
	return &ImportResult{
		Colors:        palette[:],
		Name:          bp.Name,
		Path:          savedPath,
		WallpaperPath: a.state.WallpaperPath,
		LightMode:     a.state.LightMode,
	}, nil
}

// GetTemplateColors returns the color variable names used in each app template.
// The result maps app name -> list of color variable names (only overridable color roles).
func (a *App) GetTemplateColors() map[string][]string {
	// The set of color variable names that are overridable.
	// Includes base roles, aliases (bg/fg), and derived shades.
	colorVars := map[string]bool{
		"background": true, "foreground": true,
		"bg": true, "fg": true,
		"black": true, "red": true, "green": true, "yellow": true,
		"blue": true, "magenta": true, "cyan": true, "white": true,
		"bright_black": true, "bright_red": true, "bright_green": true, "bright_yellow": true,
		"bright_blue": true, "bright_magenta": true, "bright_cyan": true, "bright_white": true,
		"accent": true, "cursor": true, "selection_foreground": true, "selection_background": true,
		"dark_bg": true, "darker_bg": true, "lighter_bg": true,
		"dark_fg": true, "light_fg": true, "bright_fg": true,
		"muted": true, "orange": true, "brown": true, "purple": true, "bright_purple": true,
		"selection": true,
	}

	// Collect unique color vars per app (multiple files may map to the same app)
	appColorSets := make(map[string]map[string]bool)
	files, err := template.ListTemplates(EmbeddedTemplates, "templates")
	if err != nil {
		return make(map[string][]string)
	}

	for _, f := range files {
		content, err := template.ReadTemplate(EmbeddedTemplates, "templates", f)
		if err != nil {
			continue
		}
		appName := theme.GetAppNameFromFileName(f)
		vars := template.ExtractVariableNames(content)
		if appColorSets[appName] == nil {
			appColorSets[appName] = make(map[string]bool)
		}
		for _, v := range vars {
			if colorVars[v] {
				appColorSets[appName][v] = true
			}
		}
	}

	// Aether's own templates are internal and should not be user-overridable
	delete(appColorSets, "aether")

	result := make(map[string][]string, len(appColorSets))
	for app, colorSet := range appColorSets {
		colors := make([]string, 0, len(colorSet))
		for v := range colorSet {
			colors = append(colors, v)
		}
		if len(colors) > 0 {
			result[app] = colors
		}
	}
	return result
}

// ResetState resets the theme state to defaults.
func (a *App) ResetState() {
	a.history.Push(*a.state)
	*a.state = *theme.NewThemeState()
}

// ---------------------------------------------------------------------------
// IPC Remote Control
// ---------------------------------------------------------------------------

// HandleIPC dispatches an IPC command from the Unix socket to the appropriate
// App method. This implements the ipc.Dispatcher interface.
func (a *App) HandleIPC(req ipc.Request) ipc.Response {
	switch strings.ToLower(req.Cmd) {
	case "status":
		return a.ipcStatus()

	case "extract":
		if req.Path == "" {
			return ipc.Response{OK: false, Error: "extract requires a path"}
		}
		mode := req.Mode
		if mode == "" {
			mode = "normal"
		}
		lightMode := false
		if req.LightMode != nil {
			lightMode = *req.LightMode
		}
		if _, err := a.ExtractColors(req.Path, lightMode, mode); err != nil {
			return ipc.Response{OK: false, Error: err.Error()}
		}
		a.emitIPCStateChanged()
		return a.ipcStatus()

	case "set-color":
		if req.Value == "" {
			return ipc.Response{OK: false, Error: "set-color requires a value"}
		}
		if req.Index < 0 || req.Index > 15 {
			return ipc.Response{OK: false, Error: "index must be 0-15"}
		}
		a.state.SetColor(req.Index, req.Value)
		a.emitIPCStateChanged()
		return a.ipcStatus()

	case "set-palette":
		if len(req.Palette) < 16 {
			return ipc.Response{OK: false, Error: "palette requires 16 colors"}
		}
		var p [16]string
		copy(p[:], req.Palette[:16])
		a.state.SetPalette(p)
		a.emitIPCStateChanged()
		return a.ipcStatus()

	case "adjust":
		adj := a.buildAdjustments(req)
		adjusted := a.AdjustPaletteColors(a.state.BasePalette[:], adj)
		var p [16]string
		copy(p[:], adjusted)
		a.state.SetAdjustedPalette(p)
		a.state.Adjustments = adj
		a.emitIPCStateChanged()
		return a.ipcStatus()

	case "set-mode":
		if req.Mode == "" {
			return ipc.Response{OK: false, Error: "set-mode requires a mode"}
		}
		a.SetExtractionMode(req.Mode)
		a.emitIPCStateChanged()
		return ipc.Response{OK: true, Mode: req.Mode}

	case "apply":
		result, err := a.ApplyTheme(ApplyThemeRequest{
			Palette:        a.state.Palette[:],
			WallpaperPath:  a.state.WallpaperPath,
			LightMode:      a.state.LightMode,
			ExtendedColors: a.state.ExtendedColors,
			AppOverrides:   a.state.AppOverrides,
		})
		if err != nil {
			return ipc.Response{OK: false, Error: err.Error()}
		}
		return ipc.Response{OK: result.Success}

	case "toggle-light-mode":
		a.state.LightMode = !a.state.LightMode
		a.emitIPCStateChanged()
		lm := a.state.LightMode
		return ipc.Response{OK: true, LightMode: &lm}

	case "load-blueprint":
		if req.Name == "" {
			return ipc.Response{OK: false, Error: "load-blueprint requires a name"}
		}
		if err := a.LoadBlueprint(req.Name); err != nil {
			return ipc.Response{OK: false, Error: err.Error()}
		}
		a.emitIPCStateChanged()
		return a.ipcStatus()

	case "apply-blueprint":
		if req.Name == "" {
			return ipc.Response{OK: false, Error: "apply-blueprint requires a name"}
		}
		result, err := a.ApplyBlueprint(req.Name)
		if err != nil {
			return ipc.Response{OK: false, Error: err.Error()}
		}
		return ipc.Response{OK: result.Success}

	case "list-blueprints":
		bps, err := a.ListBlueprints()
		if err != nil {
			return ipc.Response{OK: false, Error: err.Error()}
		}
		data, _ := json.Marshal(bps)
		return ipc.Response{OK: true, Data: data}

	case "set-wallpaper":
		if req.Path == "" {
			return ipc.Response{OK: false, Error: "set-wallpaper requires a path"}
		}
		a.state.WallpaperPath = req.Path
		a.emitIPCStateChanged()
		return ipc.Response{OK: true, Wallpaper: req.Path}

	case "get-variables":
		vars := a.ComputeVariables(a.state.Palette[:], a.state.ExtendedColors, a.state.LightMode)
		data, _ := json.Marshal(vars)
		return ipc.Response{OK: true, Data: data}

	default:
		return ipc.Response{OK: false, Error: fmt.Sprintf("unknown command: %s", req.Cmd)}
	}
}

func (a *App) ipcStatus() ipc.Response {
	palette := a.state.Palette[:]
	lm := a.state.LightMode
	return ipc.Response{
		OK:        true,
		Palette:   palette,
		LightMode: &lm,
		Mode:      a.state.ExtractionMode,
		Wallpaper: a.state.WallpaperPath,
	}
}

func (a *App) emitIPCStateChanged() {
	if a.ctx == nil {
		return
	}
	wailsrt.EventsEmit(a.ctx, "ipc-state-changed", map[string]interface{}{
		"palette":     a.state.Palette[:],
		"lightMode":   a.state.LightMode,
		"mode":        a.state.ExtractionMode,
		"wallpaper":   a.state.WallpaperPath,
		"adjustments": a.state.Adjustments,
	})
}

func (a *App) buildAdjustments(req ipc.Request) color.Adjustments {
	adj := a.state.Adjustments
	if req.Vibrance != nil {
		adj.Vibrance = *req.Vibrance
	}
	if req.Saturation != nil {
		adj.Saturation = *req.Saturation
	}
	if req.Contrast != nil {
		adj.Contrast = *req.Contrast
	}
	if req.Brightness != nil {
		adj.Brightness = *req.Brightness
	}
	if req.Shadows != nil {
		adj.Shadows = *req.Shadows
	}
	if req.Highlights != nil {
		adj.Highlights = *req.Highlights
	}
	if req.HueShift != nil {
		adj.HueShift = *req.HueShift
	}
	if req.Temperature != nil {
		adj.Temperature = *req.Temperature
	}
	if req.Tint != nil {
		adj.Tint = *req.Tint
	}
	if req.Gamma != nil {
		adj.Gamma = *req.Gamma
	}
	if req.BlackPoint != nil {
		adj.BlackPoint = *req.BlackPoint
	}
	if req.WhitePoint != nil {
		adj.WhitePoint = *req.WhitePoint
	}
	return adj
}

// --- Config JSON helpers ---

func readConfigJSON(filename string) map[string]interface{} {
	v, err := platform.ReadJSON[map[string]interface{}](filepath.Join(platform.ConfigDir(), filename))
	if err != nil {
		return nil
	}
	return v
}

func writeConfigJSON(filename string, v interface{}) error {
	return platform.WriteJSON(filepath.Join(platform.ConfigDir(), filename), v)
}
