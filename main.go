package main

import (
	"embed"
	"fmt"
	"os"
	"runtime"
	"strings"

	"aether/cli"
	"aether/internal/platform"
	"aether/ipc"

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
	guiFlags := map[string]bool{"--tab": true}

	// CLI mode: if first arg starts with -- and isn't a GUI flag, dispatch to CLI
	if len(os.Args) > 1 && strings.HasPrefix(os.Args[1], "--") && !guiFlags[os.Args[1]] {
		os.Exit(cli.Run(os.Args[1:], EmbeddedTemplates))
	}

	// IPC subcommand mode: bare commands like "aether status" route to running instance
	ipcCommands := map[string]bool{
		"status": true, "extract": true, "set-color": true, "set-palette": true,
		"adjust": true, "set-mode": true, "apply": true, "toggle-light-mode": true,
		"load-blueprint": true, "apply-blueprint": true,
		"list-blueprints": true, "set-wallpaper": true, "get-variables": true,
	}
	if len(os.Args) > 1 && ipcCommands[os.Args[1]] {
		os.Exit(cli.RunIPC(os.Args[1:]))
	}

	if ipc.IsRunning() {
		fmt.Fprintln(os.Stderr, "Aether is already running. Use IPC commands to control it.")
		os.Exit(1)
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
	focusTab := ""
	for i := 1; i < len(os.Args); i++ {
		if os.Args[i] == "--tab" && i+1 < len(os.Args) {
			focusTab = os.Args[i+1]
			i++
		}
	}

	// GUI mode: launch Wails application
	app := NewApp()
	defer app.CloseIPC()
	app.focusTab = focusTab

	err := wails.Run(&options.App{
		Title:       "Aether",
		Width:       900,
		Height:      700,
		StartHidden: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 1},
		OnStartup:        app.startup,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     false,
			DisableWebViewDrop: true,
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
