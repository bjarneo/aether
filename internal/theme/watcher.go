package theme

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"aether/internal/platform"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Duplicated from template.semanticOrder; importing template here would
// create a cycle via internal/theme -> internal/template -> internal/color.
var semanticOrder = [16]string{
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
	"bright_black",
	"bright_red",
	"bright_green",
	"bright_yellow",
	"bright_blue",
	"bright_magenta",
	"bright_cyan",
	"bright_white",
}

// ThemeWatcher polls colors.toml and emits a Wails event on change.
// Prefers the active omarchy theme and falls back to Aether's own.
type ThemeWatcher struct {
	paths    []string
	lastPath string
	lastMod  time.Time
	stop     chan struct{}
}

func NewThemeWatcher() *ThemeWatcher {
	return &ThemeWatcher{
		paths: candidatePaths(),
		stop:  make(chan struct{}),
	}
}

func candidatePaths() []string {
	paths := []string{}
	if home, err := os.UserHomeDir(); err == nil {
		paths = append(paths, filepath.Join(home, ".config", "omarchy", "current", "theme", "colors.toml"))
	}
	return append(paths, filepath.Join(platform.ThemeDir(), "colors.toml"))
}

// resolveAndParse stats each candidate in order, parses the first that
// reads successfully, and returns its path, mtime, and color map. All
// zero/nil values indicate nothing usable was found.
func (w *ThemeWatcher) resolveAndParse() (string, time.Time, map[string]string) {
	for _, p := range w.paths {
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		colors := parseColorsTOML(p)
		if colors == nil {
			continue
		}
		return p, info.ModTime(), colors
	}
	return "", time.Time{}, nil
}

// CurrentColors returns the current parsed color map. Returns nil if no
// colors.toml is readable.
func (w *ThemeWatcher) CurrentColors() map[string]string {
	_, _, colors := w.resolveAndParse()
	return colors
}

// Start begins polling the file for changes. Call from app.startup.
func (w *ThemeWatcher) Start(ctx context.Context) {
	if path, mtime, colors := w.resolveAndParse(); colors != nil {
		w.lastPath = path
		w.lastMod = mtime
		wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
	}

	go w.poll(ctx)
}

func (w *ThemeWatcher) poll(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stop:
			return
		case <-ticker.C:
			path, mtime, colors := w.resolveAndParse()
			if colors == nil {
				continue
			}
			if path == w.lastPath && !mtime.After(w.lastMod) {
				continue
			}
			w.lastPath = path
			w.lastMod = mtime
			wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
		}
	}
}

func (w *ThemeWatcher) Stop() {
	close(w.stop)
}

// parseColorsTOML reads a colors.toml and returns a map keyed by both
// color0-15 and semantic names (blue, red, …) so downstream consumers
// can use either form.
func parseColorsTOML(path string) map[string]string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	colors := make(map[string]string)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		if idx := strings.Index(val, " #"); idx >= 0 {
			val = strings.TrimSpace(val[:idx])
		}
		val = strings.Trim(val, `"'`)
		if val == "" {
			continue
		}

		colors[key] = val
	}

	for i, name := range semanticOrder {
		if v, ok := colors["color"+strconv.Itoa(i)]; ok {
			if _, set := colors[name]; !set {
				colors[name] = v
			}
		}
	}

	if len(colors) == 0 {
		return nil
	}

	log.Printf("[theme-watcher] Parsed %d colors from %s", len(colors), path)
	return colors
}
