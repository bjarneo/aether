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
	guiFlags := map[string]bool{"--widget-blueprint": true, "--widget-wallpaper-slider": true, "--widget-themes-slider": true, "--tab": true}

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

	// Check for IPC socket conflict before launching GUI.
	// Widget/slider modes are lightweight overlays — allow them even when
	// the main Aether editor is already running.
	isWidget := false
	for _, a := range os.Args[1:] {
		if guiFlags[a] {
			isWidget = true
			break
		}
	}
	if !isWidget && ipc.IsRunning() {
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
	widgetMode := false
	sliderWidget := false
	themesSlider := false
	focusTab := ""
	for i := 1; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--widget-blueprint":
			widgetMode = true
		case "--widget-wallpaper-slider":
			sliderWidget = true
		case "--widget-themes-slider":
			themesSlider = true
		case "--tab":
			if i+1 < len(os.Args) {
				focusTab = os.Args[i+1]
				i++
			}
		}
	}

	// GUI mode: launch Wails application
	app := NewApp()
	defer app.CloseIPC()
	app.widgetMode = widgetMode
	app.sliderWidget = sliderWidget
	app.themesSlider = themesSlider
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
	} else if sliderWidget || themesSlider {
		title = "Aether Slider"
		frameless = true
		alwaysOnTop = true
		width, height = platform.MonitorSize()
	}

	isSliderMode := sliderWidget || themesSlider
	bgColour := &options.RGBA{R: 30, G: 30, B: 46, A: 1}
	programName := "Aether"
	if isSliderMode {
		programName = "aether-slider"
		bgColour = &options.RGBA{R: 0, G: 0, B: 0, A: 0}
	}
	linuxOpts := &wailslinux.Options{
		ProgramName:         programName,
		WindowIsTranslucent: isSliderMode,
	}

	if isSliderMode {
		platform.SetupOverlayWindow(programName)
	}

	err := wails.Run(&options.App{
		Title:       title,
		Width:       width,
		Height:      height,
		StartHidden: true,
		Frameless:   frameless,
		AlwaysOnTop: alwaysOnTop,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: bgColour,
		OnStartup:        app.startup,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     false,
			DisableWebViewDrop: true,
		},
		Bind: []interface{}{
			app,
		},
		Linux: linuxOpts,
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
