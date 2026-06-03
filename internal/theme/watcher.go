package theme

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"aether/internal/omarchy"
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

// resolveAndStat returns the first candidate path that exists along
// with its mtime. Empty values mean nothing was found.
func (w *ThemeWatcher) resolveAndStat() (string, time.Time) {
	for _, p := range w.paths {
		if info, err := os.Stat(p); err == nil {
			return p, info.ModTime()
		}
	}
	return "", time.Time{}
}

// CurrentColors returns the current parsed color map. Returns nil if no
// colors.toml is readable.
func (w *ThemeWatcher) CurrentColors() map[string]string {
	path, _ := w.resolveAndStat()
	if path == "" {
		return nil
	}
	return parseColorsTOML(path)
}

// Start begins polling the file for changes. Call from app.startup.
func (w *ThemeWatcher) Start(ctx context.Context) {
	if path, mtime := w.resolveAndStat(); path != "" {
		w.lastPath = path
		w.lastMod = mtime
		if colors := parseColorsTOML(path); colors != nil {
			wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
		}
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
			path, mtime := w.resolveAndStat()
			if path == "" {
				continue
			}
			if path == w.lastPath && !mtime.After(w.lastMod) {
				continue
			}
			w.lastPath = path
			w.lastMod = mtime
			if colors := parseColorsTOML(path); colors != nil {
				wailsrt.EventsEmit(ctx, "theme-colors-changed", colors)
			}
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

	colors := omarchy.ParseColorsKV(string(data))

	// Bridge naming conventions so consumers can read either form regardless
	// of how the source colors.toml was written: new omarchy themes use
	// semantic names only (no colorN), Aether/legacy themes use colorN, and
	// omarchy calls slot 5 "purple" where ANSI calls it "magenta".
	alias := func(a, b string) {
		if colors[a] == "" && colors[b] != "" {
			colors[a] = colors[b]
		} else if colors[b] == "" && colors[a] != "" {
			colors[b] = colors[a]
		}
	}

	alias("magenta", "purple")
	alias("bright_magenta", "bright_purple")
	for i, name := range semanticOrder {
		alias(name, "color"+strconv.Itoa(i))
	}
	alias("bg", "background")
	alias("fg", "foreground")

	if len(colors) == 0 {
		return nil
	}

	log.Printf("[theme-watcher] Parsed %d colors from %s", len(colors), path)
	return colors
}
