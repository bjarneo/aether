package main

import (
	"embed"
	"os"
	"runtime"
	"strings"

	"aether/cli"
	"aether/internal/platform"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wailslinux "github.com/wailsapp/wails/v2/pkg/options/linux"
	wailsmac "github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// GUI flags that need the full Wails runtime (not CLI-only)
	guiFlags := map[string]bool{"--widget-blueprint": true, "--tab": true}

	// CLI mode: if first arg starts with -- and isn't a GUI flag, dispatch to CLI
	if len(os.Args) > 1 && strings.HasPrefix(os.Args[1], "--") && !guiFlags[os.Args[1]] {
		os.Exit(cli.Run(os.Args[1:], EmbeddedTemplates))
	}

	// Work around WebKitGTK + NVIDIA Wayland protocol error (Protocol error 71).
	// NVIDIA's DMA-BUF/drm_syncobj implementation can crash WebKitGTK's
	// compositor on Wayland. Disabling compositing mode prevents the crash.
	if runtime.GOOS == "linux" && platform.IsNvidiaWayland() {
		if os.Getenv("WEBKIT_DISABLE_COMPOSITING_MODE") == "" {
			os.Setenv("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
		}
	}

	// Parse GUI-specific flags
	widgetMode := false
	focusTab := ""
	for i := 1; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--widget-blueprint":
			widgetMode = true
		case "--tab":
			if i+1 < len(os.Args) {
				focusTab = os.Args[i+1]
				i++
			}
		}
	}

	// GUI mode: launch Wails application
	app := NewApp()
	app.widgetMode = widgetMode
	app.focusTab = focusTab

	width, height := 900, 700
	title := "Aether"
	frameless := false
	alwaysOnTop := false
	if widgetMode {
		width, height = 300, 420
		title = "Aether Blueprints"
		frameless = true
		alwaysOnTop = true
	}

	err := wails.Run(&options.App{
		Title:       title,
		Width:       width,
		Height:      height,
		Frameless:   frameless,
		AlwaysOnTop: alwaysOnTop,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 1},
		OnStartup:        app.startup,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: false,
		},
		Bind: []interface{}{
			app,
		},
		Linux: &wailslinux.Options{
			ProgramName: "Aether",
		},
		Mac: &wailsmac.Options{
			TitleBar:             wailsmac.TitleBarHiddenInset(),
			WebviewIsTransparent: true,
			WindowIsTranslucent:  false,
			About: &wailsmac.AboutInfo{
				Title:   "Aether",
				Message: "Desktop Theming Application",
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
