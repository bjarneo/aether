package cli

import (
	"embed"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"aether/internal/blueprint"
	"aether/internal/pending"
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
	silent := false
	if v := strings.ToLower(q.Get("silent")); v == "true" || v == "1" || v == "yes" {
		silent = true
	}

	if v := strings.ToLower(q.Get("mode")); v != "" {
		if v != "light" && v != "dark" {
			fmt.Fprintf(os.Stderr, "Error: mode must be 'light' or 'dark', got %q\n", v)
			return 1
		}
		imp.Mode = v
	}
	if v := strings.ToLower(q.Get("edit")); v == "true" || v == "1" || v == "yes" {
		imp.Edit = true
	}
	if v := q.Get("as_omarchy_theme"); v != "" {
		if !theme.ValidOmarchyThemeName(v) {
			fmt.Fprintf(os.Stderr, "Error: as_omarchy_theme must match [A-Za-z0-9][A-Za-z0-9_.-]* (got %q)\n", v)
			return 1
		}
		imp.OmarchyThemeName = strings.ToLower(v)
	}
	if q.Get("external_theme") != "" && q.Get("colors") != "" {
		fmt.Fprintln(os.Stderr, "Error: external_theme and colors cannot be combined")
		return 1
	}

	if v := q.Get("external_theme"); v != "" {
		p, err := wallpaper.DownloadToCache(v, wallpaper.MaxDocumentBytes)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download external_theme: %v\n", err)
			return 1
		}
		if _, err := blueprint.ImportJSON(p); err != nil {
			_ = os.Remove(p)
			fmt.Fprintf(os.Stderr, "Error: invalid external_theme: %v\n", err)
			return 1
		}
		imp.ExternalTheme = p
	}
	if v := q.Get("colors"); v != "" {
		p, err := wallpaper.DownloadToCache(v, wallpaper.MaxDocumentBytes)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download colors: %v\n", err)
			return 1
		}
		if _, err := blueprint.ImportColorsToml(p); err != nil {
			_ = os.Remove(p)
			fmt.Fprintf(os.Stderr, "Error: invalid colors: %v\n", err)
			return 1
		}
		imp.ColorsToml = p
	}
	if v := q.Get("wallpaper"); v != "" {
		p, err := wallpaper.DownloadToCache(v, wallpaper.MaxImageBytes)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: download wallpaper: %v\n", err)
			return 1
		}
		if err := wallpaper.ValidateImageFile(p); err != nil {
			_ = os.Remove(p)
			fmt.Fprintf(os.Stderr, "Error: invalid wallpaper: %v\n", err)
			return 1
		}
		imp.Wallpaper = p
	}
	if imp.ExternalTheme == "" && imp.ColorsToml == "" && imp.Wallpaper == "" {
		fmt.Fprintln(os.Stderr, "Error: URL has no external_theme=, colors=, or wallpaper= parameter")
		return 1
	}
	if silent && !imp.Edit {
		return runSilentURLApply(&imp, templatesFS)
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

func runSilentURLApply(imp *pending.Import, templatesFS embed.FS) int {
	state, err := buildURLImportState(imp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: prepare silent apply: %v\n", err)
		return 1
	}

	writer := theme.NewWriter(templatesFS, "templates")
	if imp.OmarchyThemeName != "" {
		if err := writer.InstallOmarchyTheme(state, theme.DefaultApplySettings(), imp.OmarchyThemeName); err != nil {
			fmt.Fprintf(os.Stderr, "Error: install Omarchy theme: %v\n", err)
			return 1
		}
		fmt.Printf("Installed and activated Omarchy theme %q\n", imp.OmarchyThemeName)
		return 0
	}

	result, err := writer.ApplyTheme(state, theme.DefaultApplySettings())
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: apply theme: %v\n", err)
		return 1
	}
	if !result.Success {
		fmt.Fprintln(os.Stderr, "Error: apply returned failure")
		return 1
	}
	fmt.Println("Theme applied successfully")
	return 0
}

func buildURLImportState(imp *pending.Import) (*theme.ThemeState, error) {
	var bp *blueprint.Blueprint
	var err error
	switch {
	case imp.ExternalTheme != "":
		bp, err = blueprint.ImportJSON(imp.ExternalTheme)
	case imp.ColorsToml != "":
		bp, err = blueprint.ImportColorsToml(imp.ColorsToml)
	default:
		bp, err = blueprint.ImportCurrentColorsToml()
	}
	if err != nil {
		return nil, err
	}

	state := theme.NewThemeState()
	state.WallpaperPath = imp.Wallpaper
	for key, value := range bp.Palette.ExtendedColors {
		state.ExtendedColors[key] = value
	}
	for key, value := range bp.Palette.NativeColors {
		state.NativeColors[key] = value
	}
	var palette [16]string
	copy(palette[:], bp.Palette.Colors)
	state.SetPalette(palette)

	switch imp.Mode {
	case "light":
		state.LightMode = true
	case "dark":
		state.LightMode = false
	default:
		state.LightMode = bp.Palette.Mode == "light" || (bp.Palette.Mode == "" && bp.Palette.LightMode)
	}
	return state, nil
}
