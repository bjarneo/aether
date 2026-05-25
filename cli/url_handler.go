package cli

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"aether/internal/pending"
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
func runHandleURL(args []string) int {
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

	if imp.ExternalTheme == "" && imp.ColorsToml == "" && imp.Wallpaper == "" {
		fmt.Fprintln(os.Stderr, "Error: URL has no external_theme=, colors=, or wallpaper= parameter")
		return 1
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
