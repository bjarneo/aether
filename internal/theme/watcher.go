package theme

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aether/internal/platform"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ThemeWatcher monitors the aether.override.css file for changes and
// emits Wails events with the parsed color values so the frontend can
// apply them as CSS custom properties.
type ThemeWatcher struct {
	ctx     context.Context
	path    string
	lastMod time.Time
	stop    chan struct{}
}

// NewThemeWatcher creates a watcher for the override CSS file.
func NewThemeWatcher() *ThemeWatcher {
	overridePath := filepath.Join(platform.ConfigDir(), "theme.override.css")
	return &ThemeWatcher{
		path: overridePath,
		stop: make(chan struct{}),
	}
}

// Start begins polling the file for changes. Call from app.startup.
func (w *ThemeWatcher) Start(ctx context.Context) {
	w.ctx = ctx

	// Emit initial colors
	if colors := w.parseColors(); colors != nil {
		wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
	}

	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-w.stop:
				return
			case <-ticker.C:
				info, err := os.Stat(w.path)
				if err != nil {
					continue
				}
				if info.ModTime().After(w.lastMod) {
					w.lastMod = info.ModTime()
					if colors := w.parseColors(); colors != nil {
						wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
					}
				}
			}
		}
	}()
}

// Stop halts the watcher.
func (w *ThemeWatcher) Stop() {
	close(w.stop)
}

// parseColors reads the override CSS and extracts @define-color values.
func (w *ThemeWatcher) parseColors() map[string]string {
	data, err := os.ReadFile(w.path)
	if err != nil {
		// Try the generated file in the theme dir
		alt := filepath.Join(platform.ThemeDir(), "aether.override.css")
		data, err = os.ReadFile(alt)
		if err != nil {
			return nil
		}
	}

	colors := make(map[string]string)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "@define-color ") {
			continue
		}
		// @define-color name value;
		rest := strings.TrimPrefix(line, "@define-color ")
		rest = strings.TrimSuffix(rest, ";")
		parts := strings.SplitN(rest, " ", 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Skip references like @background (not hex values)
		if strings.HasPrefix(value, "@") || strings.HasPrefix(value, "alpha(") {
			continue
		}

		colors[name] = value
	}

	if len(colors) == 0 {
		return nil
	}

	log.Printf("[theme-watcher] Parsed %d colors from override CSS", len(colors))
	return colors
}
