package cli

import (
	"embed"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

// safeThemeName allows only filename-friendly characters in an omarchy theme
// name. Reject path separators and shell metachars; the name is used both as
// a directory name and as an argument to omarchy-theme-set.
var safeThemeName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`)

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
	if v := q.Get("as_omarchy_theme"); v != "" {
		if !safeThemeName.MatchString(v) {
			fmt.Fprintf(os.Stderr, "Error: as_omarchy_theme must match [A-Za-z0-9][A-Za-z0-9_.-]* (got %q)\n", v)
			return 1
		}
		imp.OmarchyThemeName = v
	}

	if imp.ExternalTheme == "" && imp.ColorsToml == "" && imp.Wallpaper == "" {
		fmt.Fprintln(os.Stderr, "Error: URL has no external_theme=, colors=, or wallpaper= parameter")
		return 1
	}

	// Omarchy install: drop files into ~/.config/omarchy/themes/<name>/ and
	// run omarchy-theme-set. Always silent — installing into a system
	// location is the consent action by the publisher.
	if imp.OmarchyThemeName != "" {
		return runOmarchyInstall(&imp, templatesFS)
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

// runOmarchyInstall renders the imported theme directly into
// ~/.config/omarchy/themes/<name>/ — colors.toml + backgrounds/<wp> + all
// the per-app templates — and then runs `omarchy-theme-set <name>`. The
// theme name has already been validated against safeThemeName, so it's safe
// to use as both a filesystem path component and an argv argument.
func runOmarchyInstall(imp *pending.Import, templatesFS embed.FS) int {
	if !theme.IsOmarchyInstalled() {
		fmt.Fprintln(os.Stderr, "Error: omarchy-theme-set not found in PATH; cannot install as an omarchy theme")
		return 1
	}

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
		// Wallpaper-only install: borrow the palette from the currently
		// applied colors.toml so the rendered theme isn't blank.
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
		}
	}

	if !paletteHasColors(palette) {
		fmt.Fprintln(os.Stderr, "Error: no palette to install (URL had no colors/external_theme and no existing colors.toml to borrow from)")
		return 1
	}

	lightMode := imp.Mode == "light"

	targetDir := filepath.Join(platform.OmarchyThemesDir(), imp.OmarchyThemeName)
	if err := platform.EnsureDir(targetDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error: create theme dir: %v\n", err)
		return 1
	}

	colorRoles := MapColorsToRoles(palette)
	writer := theme.NewWriter(templatesFS, "templates")
	state := &theme.ThemeState{
		Palette:        palette,
		WallpaperPath:  imp.Wallpaper,
		LightMode:      lightMode,
		ColorRoles:     colorRoles,
		ExtendedColors: extended,
	}

	fmt.Printf("Installing omarchy theme %q to: %s\n", imp.OmarchyThemeName, targetDir)
	if err := writer.GenerateOnly(state, theme.Settings{}, targetDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error: render templates: %v\n", err)
		return 1
	}

	fmt.Printf("Activating: omarchy-theme-set %s\n", imp.OmarchyThemeName)
	if out, err := platform.RunSync("omarchy-theme-set", imp.OmarchyThemeName); err != nil {
		fmt.Fprintf(os.Stderr, "Error: omarchy-theme-set failed: %v\n", err)
		if out != "" {
			fmt.Fprintln(os.Stderr, out)
		}
		return 1
	}

	fmt.Println("Omarchy theme installed and activated")
	return 0
}

// paletteHasColors reports whether a palette has at least one non-empty slot.
func paletteHasColors(p [16]string) bool {
	for _, c := range p {
		if c != "" {
			return true
		}
	}
	return false
}
