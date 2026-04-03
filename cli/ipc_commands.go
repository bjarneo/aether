package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"aether/ipc"
)

// RunIPC dispatches bare subcommands to a running Aether instance via IPC.
// These commands require a running Aether GUI.
func RunIPC(args []string) int {
	if len(args) == 0 {
		return 1
	}

	jsonOut, args := stripJSON(args)
	cmd := args[0]
	rest := args[1:]

	req := ipc.Request{Cmd: cmd}

	switch cmd {
	case "extract":
		if len(rest) == 0 {
			return ipcError(jsonOut, "Usage: aether extract <wallpaper> [--mode X] [--light-mode]")
		}
		req.Path = expandHome(rest[0])
		mode, rest := parseFlag(rest[1:], "--mode")
		if mode != "" {
			req.Mode = mode
		}
		lm, _ := hasFlag(rest, "--light-mode")
		if lm {
			req.LightMode = &lm
		}

	case "set-color":
		if len(rest) < 2 {
			return ipcError(jsonOut, "Usage: aether set-color <index> <hex>")
		}
		idx, err := strconv.Atoi(rest[0])
		if err != nil {
			return ipcError(jsonOut, "Invalid index: "+rest[0])
		}
		req.Index = idx
		req.Value = normalizeHex(rest[1])

	case "set-palette":
		if len(rest) == 0 {
			return ipcError(jsonOut, "Usage: aether set-palette <json-array>")
		}
		var colors []string
		if err := json.Unmarshal([]byte(rest[0]), &colors); err != nil {
			return ipcError(jsonOut, "Invalid JSON palette: "+err.Error())
		}
		req.Palette = colors

	case "adjust":
		provided := parseFlagNames(rest)
		adj, _ := parseAdjustmentFlags(rest)
		if provided["--vibrance"] {
			req.Vibrance = &adj.Vibrance
		}
		if provided["--saturation"] {
			req.Saturation = &adj.Saturation
		}
		if provided["--contrast"] {
			req.Contrast = &adj.Contrast
		}
		if provided["--brightness"] {
			req.Brightness = &adj.Brightness
		}
		if provided["--shadows"] {
			req.Shadows = &adj.Shadows
		}
		if provided["--highlights"] {
			req.Highlights = &adj.Highlights
		}
		if provided["--hue-shift"] {
			req.HueShift = &adj.HueShift
		}
		if provided["--temperature"] {
			req.Temperature = &adj.Temperature
		}
		if provided["--tint"] {
			req.Tint = &adj.Tint
		}
		if provided["--gamma"] {
			req.Gamma = &adj.Gamma
		}
		if provided["--black-point"] {
			req.BlackPoint = &adj.BlackPoint
		}
		if provided["--white-point"] {
			req.WhitePoint = &adj.WhitePoint
		}

	case "set-mode":
		if len(rest) == 0 {
			return ipcError(jsonOut, "Usage: aether set-mode <mode>")
		}
		req.Mode = rest[0]

	case "load-blueprint", "apply-blueprint":
		if len(rest) == 0 {
			return ipcError(jsonOut, "Usage: aether "+cmd+" <name>")
		}
		req.Name = rest[0]

	case "set-wallpaper":
		if len(rest) == 0 {
			return ipcError(jsonOut, "Usage: aether set-wallpaper <path>")
		}
		req.Path = expandHome(rest[0])

	case "status", "apply", "toggle-light-mode", "list-blueprints", "get-variables":
		// No extra args needed

	default:
		return ipcError(jsonOut, "Unknown IPC command: "+cmd)
	}

	resp, err := ipc.Send(ipc.DefaultSocketPath(), req)
	if err != nil {
		if jsonOut {
			return printErrorJSON(err.Error())
		}
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	if !resp.OK {
		if jsonOut {
			return printErrorJSON(resp.Error)
		}
		fmt.Fprintln(os.Stderr, "Error:", resp.Error)
		return 1
	}

	if jsonOut {
		return printJSON(resp)
	}

	// Human-readable output
	switch cmd {
	case "status":
		printStatus(resp)
	case "extract":
		printStatus(resp)
	case "set-color", "set-palette", "adjust":
		printStatus(resp)
	case "toggle-light-mode":
		if resp.LightMode != nil {
			fmt.Printf("Light mode: %v\n", *resp.LightMode)
		}
	case "load-blueprint":
		printStatus(resp)
	default:
		fmt.Println("OK")
	}
	return 0
}

func printStatus(resp ipc.Response) {
	if resp.Mode != "" {
		fmt.Printf("Mode: %s\n", resp.Mode)
	}
	if resp.LightMode != nil {
		fmt.Printf("Light mode: %v\n", *resp.LightMode)
	}
	if resp.Wallpaper != "" {
		fmt.Printf("Wallpaper: %s\n", resp.Wallpaper)
	}
	if len(resp.Palette) > 0 {
		fmt.Println("Palette:")
		for i, c := range resp.Palette {
			if i < 16 {
				fmt.Printf("  %2d %-16s %s\n", i, paletteNames[i], c)
			}
		}
	}
}

func ipcError(jsonOut bool, msg string) int {
	if jsonOut {
		return printErrorJSON(msg)
	}
	fmt.Fprintln(os.Stderr, msg)
	return 1
}
