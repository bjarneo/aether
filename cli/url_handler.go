package cli

import (
	"embed"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"aether/internal/blueprint"
	"aether/internal/omarchy"
	"aether/internal/pending"
	"aether/internal/platform"
	"aether/internal/theme"
	"aether/internal/wallpaper"
	"aether/ipc"
)

// runHandleURL parses an aether:// URL, downloads any referenced HTTPS assets,
// and either hands them to a running GUI (via IPC) or stages them in the
// pending-import file and launches the GUI.
//
// Supported scheme:
//
//	aether://apply?external_theme=https://…/theme.json
//	aether://apply?colors=https://…/colors.toml
//	aether://apply?wallpaper=https://…/wp.jpg
//	aether://apply?colors=…&wallpaper=…
func runHandleURL(args []string, templatesFS embed.FS) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Usage: aether --handle-url <aether://...>")
		return 1
	}

	raw := args[0]
	u, err := url.Parse(raw)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid URL: %v\n", err)
		return 1
	}
	if u.Scheme != "aether" {
		fmt.Fprintf(os.Stderr, "Error: expected aether:// scheme, got %q\n", u.Scheme)
		return 1
	}

	action := u.Host
	if action == "" {
		action = strings.TrimPrefix(u.Path, "/")
	}
	if action != "apply" {
		fmt.Fprintf(os.Stderr, "Error: unsupported action %q (expected 'apply')\n", action)
		return 1
	}

	q := u.Query()
	imp := pending.Import{SourceURL: raw, Timestamp: time.Now().Unix()}

	if v := q.Get("external_theme"); v != "" {
		p, err := wallpaper.DownloadToCache(v)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download external_theme: %v\n", err)
			return 1
		}
		imp.ExternalTheme = p
	}
	if v := q.Get("colors"); v != "" {
		p, err := wallpaper.DownloadToCache(v)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download colors: %v\n", err)
			return 1
		}
		imp.ColorsToml = p
	}
	if v := q.Get("wallpaper"); v != "" {
		p, err := wallpaper.DownloadToCache(v)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download wallpaper: %v\n", err)
			return 1
		}
		imp.Wallpaper = p
	}
	if v := strings.ToLower(q.Get("mode")); v != "" {
		if v != "light" && v != "dark" {
			fmt.Fprintf(os.Stderr, "Error: mode must be 'light' or 'dark', got %q\n", v)
			return 1
		}
		imp.Mode = v
	}
	if v := strings.ToLower(q.Get("silent")); v == "true" || v == "1" || v == "yes" {
		imp.Silent = true
	}

	if imp.ExternalTheme == "" && imp.ColorsToml == "" && imp.Wallpaper == "" {
		fmt.Fprintln(os.Stderr, "Error: URL has no external_theme=, colors=, or wallpaper= parameter")
		return 1
	}

	// Silent mode: apply directly in this process, no GUI, no dialog.
	// Matches `aether --import-colors-toml` semantics — first-party flows
	// only, since any web page can construct silent URLs.
	if imp.Silent {
		return runSilentApply(&imp, templatesFS)
	}

	if err := pending.Write(&imp); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	// If the GUI is already running, notify it. Otherwise spawn a detached
	// aether process; its startup hook will pick the file up.
	if ipc.IsRunning() {
		resp, err := ipc.Send(ipc.DefaultSocketPath(), ipc.Request{Cmd: "pending-import"})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: IPC notify failed: %v\n", err)
			return 1
		}
		if !resp.OK {
			fmt.Fprintf(os.Stderr, "Warning: GUI rejected pending import: %s\n", resp.Error)
			return 1
		}
		fmt.Println("Sent to running Aether.")
		return 0
	}

	exe, err := os.Executable()
	if err != nil {
		exe = "aether"
	}
	cmd := exec.Command(exe)
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: launching Aether: %v\n", err)
		return 1
	}
	_ = cmd.Process.Release()
	fmt.Println("Launching Aether.")
	return 0
}

// runSilentApply runs the equivalent of `--import-colors-toml URL` directly
// inside the URL-handler process: parse the downloaded palette source, build
// a ThemeState, and call writer.ApplyTheme. When only a wallpaper was given,
// the current colors.toml on disk is reused so the existing palette is kept
// instead of clobbered. Never touches the GUI or IPC.
func runSilentApply(imp *pending.Import, templatesFS embed.FS) int {
	var palette [16]string
	var bp *blueprint.Blueprint
	var err error

	switch {
	case imp.ExternalTheme != "":
		bp, err = blueprint.ImportJSON(imp.ExternalTheme)
	case imp.ColorsToml != "":
		bp, err = blueprint.ImportColorsToml(imp.ColorsToml)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: parse: %v\n", err)
		return 1
	}

	extended := map[string]string{}
	if bp != nil {
		for i := 0; i < 16 && i < len(bp.Palette.Colors); i++ {
			palette[i] = bp.Palette.Colors[i]
		}
		for k, v := range bp.Palette.ExtendedColors {
			extended[k] = v
		}
	} else {
		// Wallpaper-only silent apply: preserve current palette by reading
		// the existing applied colors.toml. Falls back to a default-ish
		// state when nothing has been applied yet.
		existing := filepath.Join(platform.ThemeDir(), "colors.toml")
		if data, err := os.ReadFile(existing); err == nil {
			current, bg, fg := omarchy.ParseColorsToml(string(data))
			palette = current
			if bg != "" {
				extended["background"] = bg
			}
			if fg != "" {
				extended["foreground"] = fg
			}
		} else {
			fmt.Fprintln(os.Stderr, "Warning: no existing colors.toml to preserve; palette will be empty")
		}
	}

	// mode= is the only signal we have for light/dark in the silent CLI
	// path. Omit → false (matches existing --import-colors-toml default).
	lightMode := imp.Mode == "light"

	colorRoles := MapColorsToRoles(palette)
	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:        palette,
		WallpaperPath:  imp.Wallpaper,
		LightMode:      lightMode,
		ColorRoles:     colorRoles,
		ExtendedColors: extended,
	}

	fmt.Println("Applying theme silently...")
	result, err := writer.ApplyTheme(state, theme.Settings{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: apply: %v\n", err)
		return 1
	}
	if result.Success {
		fmt.Println("Theme applied successfully")
	}
	_ = pending.Clear() // best-effort cleanup of any prior staged file
	return 0
}
