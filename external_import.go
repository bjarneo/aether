package main

import (
	"fmt"
	"log"
	"os"
	"sync"

	"aether/internal/blueprint"
	"aether/internal/omarchy"
	"aether/internal/pending"
	"aether/internal/theme"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// pendingImportState holds the most recent pending import surfaced to the
// frontend. The dialog reads it via GetPendingExternalImport, then either
// confirms (applying the assets verbatim, no extraction) or cancels.
type pendingImportState struct {
	mu   sync.Mutex
	curr *pending.Import
}

// ExternalImportPreview is the payload sent to the frontend so the
// confirmation dialog can render swatches + wallpaper preview without making
// extra calls back into Go.
type ExternalImportPreview struct {
	HasExternalTheme bool     `json:"has_external_theme"`
	HasColors        bool     `json:"has_colors"`
	HasWallpaper     bool     `json:"has_wallpaper"`
	SourceURL        string   `json:"source_url"`
	Palette          []string `json:"palette,omitempty"`
	Wallpaper        string   `json:"wallpaper,omitempty"`
	ThemeName        string   `json:"theme_name,omitempty"`
	Mode             string   `json:"mode,omitempty"` // "light" | "dark" | ""
}

// loadPendingImport reads the staged file, stores it in memory, and emits
// "external-import-requested" to the frontend. Safe to call from startup
// and from the IPC handler — repeated calls just refresh the in-memory
// snapshot and re-emit. Silent imports never reach the GUI (the CLI URL
// handler applies them directly), so no branching is needed here.
func (a *App) loadPendingImport() {
	imp, err := pending.Read()
	if err != nil {
		log.Printf("pending-import: %v", err)
		return
	}
	if imp == nil {
		return
	}

	a.pending.mu.Lock()
	a.pending.curr = imp
	a.pending.mu.Unlock()

	if a.ctx != nil {
		preview := a.buildPreview(imp)
		wailsrt.EventsEmit(a.ctx, "external-import-requested", preview)
	}
}

// buildPreview reads the staged assets enough to populate the dialog.
// For external_theme + colors it parses the file so swatches can be shown.
// Errors degrade gracefully (preview shows what it can).
func (a *App) buildPreview(imp *pending.Import) ExternalImportPreview {
	preview := ExternalImportPreview{
		SourceURL:        imp.SourceURL,
		HasExternalTheme: imp.ExternalTheme != "",
		HasColors:        imp.ColorsToml != "",
		HasWallpaper:     imp.Wallpaper != "",
		Wallpaper:        imp.Wallpaper,
		Mode:             imp.Mode,
	}

	if imp.ExternalTheme != "" {
		if bp, err := blueprint.ImportJSON(imp.ExternalTheme); err == nil {
			preview.ThemeName = bp.Name
			preview.Palette = clonePalette(bp.Palette.Colors)
		} else {
			log.Printf("pending-import: parse external_theme: %v", err)
		}
	} else if imp.ColorsToml != "" {
		if bp, err := blueprint.ImportColorsToml(imp.ColorsToml); err == nil {
			preview.ThemeName = bp.Name
			preview.Palette = clonePalette(bp.Palette.Colors)
		} else {
			log.Printf("pending-import: parse colors.toml: %v", err)
		}
	}

	return preview
}

// GetPendingExternalImport returns the active preview for the dialog. nil
// (zero value) when nothing is pending — the frontend mounts the dialog on
// the event, then pulls this for the actual payload.
func (a *App) GetPendingExternalImport() *ExternalImportPreview {
	a.pending.mu.Lock()
	imp := a.pending.curr
	a.pending.mu.Unlock()
	if imp == nil {
		return nil
	}
	preview := a.buildPreview(imp)
	return &preview
}

// ConfirmExternalImport applies the staged assets verbatim: the colors.toml
// (or external_theme JSON) becomes the palette without re-extracting, and
// the wallpaper is set as the background. Auto-extraction is intentionally
// skipped — the user already trusts the source.
func (a *App) ConfirmExternalImport() error {
	a.pending.mu.Lock()
	imp := a.pending.curr
	a.pending.curr = nil
	a.pending.mu.Unlock()

	if imp == nil {
		return fmt.Errorf("no pending import")
	}

	defer pending.Clear()

	a.history.Push(*a.state)

	var bp *blueprint.Blueprint
	var err error
	switch {
	case imp.ExternalTheme != "":
		bp, err = blueprint.ImportJSON(imp.ExternalTheme)
	case imp.ColorsToml != "":
		bp, err = blueprint.ImportColorsToml(imp.ColorsToml)
	}
	if err != nil {
		return fmt.Errorf("parse import: %w", err)
	}

	if bp != nil {
		var palette [16]string
		for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
			palette[i] = bp.Palette.Colors[i]
		}
		a.state.SetPalette(palette)

		if len(bp.Palette.ExtendedColors) > 0 {
			if a.state.ExtendedColors == nil {
				a.state.ExtendedColors = map[string]string{}
			}
			for k, v := range bp.Palette.ExtendedColors {
				a.state.ExtendedColors[k] = v
			}
		}
	}

	if imp.Wallpaper != "" {
		if _, statErr := os.Stat(imp.Wallpaper); statErr == nil {
			a.state.WallpaperPath = imp.Wallpaper
		}
	}

	// Light/dark precedence: explicit URL mode= wins. Otherwise, if the
	// import was a colors.toml, re-parse to read its own `mode = "..."`
	// line (handles both light and dark explicitly). Otherwise an
	// external_theme JSON may have set LightMode=true. Otherwise leave
	// the current setting alone.
	switch imp.Mode {
	case "light":
		a.state.LightMode = true
	case "dark":
		a.state.LightMode = false
	default:
		applied := false
		if imp.ColorsToml != "" {
			if data, readErr := os.ReadFile(imp.ColorsToml); readErr == nil {
				_, _, _, m := omarchy.ParseColorsToml(string(data))
				switch m {
				case "light":
					a.state.LightMode = true
					applied = true
				case "dark":
					a.state.LightMode = false
					applied = true
				}
			}
		}
		if !applied && bp != nil && bp.Palette.LightMode {
			a.state.LightMode = true
		}
	}

	result, err := a.writer.ApplyTheme(a.state, theme.DefaultApplySettings())
	if err != nil {
		return fmt.Errorf("apply: %w", err)
	}
	if !result.Success {
		return fmt.Errorf("apply returned failure")
	}
	a.emitIPCStateChanged()
	return nil
}

// CancelExternalImport drops the staged import without touching theme state.
func (a *App) CancelExternalImport() {
	a.pending.mu.Lock()
	a.pending.curr = nil
	a.pending.mu.Unlock()
	_ = pending.Clear()
}

func clonePalette(colors []string) []string {
	out := make([]string, len(colors))
	copy(out, colors)
	return out
}
