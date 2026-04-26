package batch

import (
	"context"
	"sync"

	"aether/internal/extraction"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// MaxBatchSize is the maximum number of wallpapers per batch.
const MaxBatchSize = 10

// ItemResult holds the outcome of processing one wallpaper.
type ItemResult struct {
	Index   int      `json:"index"`
	Path    string   `json:"path"`
	Colors  []string `json:"colors,omitempty"`
	Success bool     `json:"success"`
	Error   string   `json:"error,omitempty"`
}

// Processor manages batch color extraction with cancellation support.
type Processor struct {
	mu      sync.Mutex
	cancel  context.CancelFunc
	running bool
}

// NewProcessor creates a new batch processor.
func NewProcessor() *Processor {
	return &Processor{}
}

// Start begins sequential extraction, emitting Wails events per item.
func (p *Processor) Start(appCtx context.Context, paths []string, lightMode bool) {
	p.mu.Lock()
	if p.running {
		p.mu.Unlock()
		return
	}
	if len(paths) > MaxBatchSize {
		paths = paths[:MaxBatchSize]
	}

	// Derive from appCtx so app shutdown cancels in-flight batches.
	ctx, cancel := context.WithCancel(appCtx)
	p.cancel = cancel
	p.running = true
	p.mu.Unlock()

	go func() {
		defer func() {
			p.mu.Lock()
			p.running = false
			p.mu.Unlock()
		}()

		var results []ItemResult
		for i, path := range paths {
			select {
			case <-ctx.Done():
				wailsrt.EventsEmit(appCtx, "batch-cancelled")
				return
			default:
			}

			wailsrt.EventsEmit(appCtx, "batch-item-started", map[string]interface{}{
				"index": i, "path": path, "total": len(paths),
			})

			palette, err := extraction.ExtractColors(path, lightMode, "normal")
			result := ItemResult{Index: i, Path: path}
			if err != nil {
				result.Error = err.Error()
			} else {
				result.Success = true
				result.Colors = palette[:]
			}
			results = append(results, result)

			wailsrt.EventsEmit(appCtx, "batch-item-completed", result)
		}

		wailsrt.EventsEmit(appCtx, "batch-completed", results)
	}()
}

// Cancel stops the current batch.
func (p *Processor) Cancel() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.cancel != nil {
		p.cancel()
	}
}

// IsRunning reports whether processing is active.
func (p *Processor) IsRunning() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.running
}
