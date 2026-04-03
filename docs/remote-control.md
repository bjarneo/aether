# Remote Control (IPC)

Control a running Aether instance from another terminal, a shell script, or an AI coding assistant.

When Aether starts, it listens on a Unix domain socket at `~/.config/aether/aether.sock`. CLI subcommands connect to this socket to send commands and receive state back.

## Quick Start

```sh
# Check what the editor currently has
aether status

# Load a wallpaper and extract colors into the editor
aether extract ~/Wallpapers/forest.jpg

# Adjust the palette (moves the sidebar sliders)
aether adjust --vibrance 20 --contrast 10

# Apply the current theme to the system
aether apply
```

## Editor Commands

These commands control the running GUI editor in real time. The palette grid, sliders, and wallpaper preview all update instantly.

### Status

```sh
aether status              # human-readable
aether status --json       # machine-readable
```

Returns the current palette (16 colors), extraction mode, light/dark mode, and wallpaper path.

### Extract Colors

Load a wallpaper into the editor and extract its palette:

```sh
aether extract /path/to/wallpaper.jpg
aether extract /path/to/wallpaper.jpg --mode pastel
aether extract /path/to/wallpaper.jpg --mode analogous --light-mode
```

### Set Individual Color

Change a single color in the palette grid by index (0-15):

```sh
aether set-color 0 "#0a180a"    # background
aether set-color 4 "#53ba97"    # blue slot
aether set-color 7 "#a5baa7"    # foreground
```

### Set Entire Palette

Replace all 16 colors at once with a JSON array:

```sh
aether set-palette '["#0a180a","#a8ad42","#7cd480","#a0c877","#53ba97","#7cc094","#8fd7b0","#a5baa7","#39513c","#a8ad42","#7cd480","#a0c877","#53ba97","#7cc094","#8fd7b0","#bed3c0"]'
```

### Adjust Palette

Apply adjustment sliders to the palette. Values work the same as the sidebar sliders in the GUI. Adjustments are always applied to the base palette (non-destructive), so calling `--vibrance 10` then `--vibrance 20` gives you vibrance 20, not 30.

```sh
aether adjust --vibrance 20
aether adjust --saturation -10 --contrast 15
aether adjust --temperature 30 --tint -5
aether adjust --brightness 10 --shadows 5 --highlights -5
aether adjust --hue-shift 45
aether adjust --gamma 1.2 --black-point 5 --white-point -3
```

All 12 adjustment flags:

| Flag | Range | Description |
|------|-------|-------------|
| `--vibrance` | -100 to 100 | Additive saturation boost |
| `--saturation` | -100 to 100 | Multiplicative saturation |
| `--contrast` | -100 to 100 | Expand/compress lightness around midpoint |
| `--brightness` | -100 to 100 | Shift lightness up or down |
| `--shadows` | -100 to 100 | Adjust dark colors only (L < 30) |
| `--highlights` | -100 to 100 | Adjust light colors only (L > 70) |
| `--hue-shift` | -180 to 180 | Rotate all hues |
| `--temperature` | -100 to 100 | Warm (positive) or cool (negative) |
| `--tint` | -100 to 100 | Magenta (positive) or green (negative) |
| `--gamma` | 0.1 to 3.0 | Gamma correction (default 1.0) |
| `--black-point` | -50 to 50 | Raise or lower the black floor |
| `--white-point` | -50 to 50 | Lower or raise the white ceiling |

### Set Extraction Mode

```sh
aether set-mode pastel
aether set-mode colorful
```

### Toggle Light/Dark Mode

```sh
aether toggle-light-mode
```

### Set Wallpaper

Change the wallpaper path without extracting colors:

```sh
aether set-wallpaper /path/to/wallpaper.jpg
```

### Apply Theme

Apply the current editor state to the system (generates templates, symlinks, restarts apps):

```sh
aether apply
```

### Blueprints

```sh
aether load-blueprint "Nord"       # load into editor
aether apply-blueprint "Nord"      # apply directly to system
aether list-blueprints             # list available blueprints
```

## Headless CLI Commands

These commands work without a running Aether GUI. They are useful for scripts, pipelines, and AI tools that need color data without side effects.

All headless commands support `--json` for machine-readable output.

### Color Utilities

```sh
# Get all representations of a color
aether --color-info "#7cd480"
aether --color-info "#7cd480" --json

# Convert between formats
aether --color-convert "#7cd480" --to hsl
aether --color-convert "#7cd480" --to oklch

# Check WCAG contrast ratio
aether --contrast "#0a180a" "#a5baa7"

# Adjust a single color
aether --adjust-color "#7cd480" --vibrance 20 --saturation -10

# Darken or lighten
aether --darken "#7cd480" 70
aether --lighten "#7cd480" 20
```

### Palette Operations

```sh
# Extract palette from wallpaper (read-only, no side effects)
aether --extract-palette ~/wallpaper.jpg
aether --extract-palette ~/wallpaper.jpg --extract-mode pastel --json

# Generate palette from a single color
aether --palette-from-color "#7cd480"

# Generate a gradient
aether --gradient "#0a180a" "#bed3c0"
aether --gradient "#0a180a" "#bed3c0" --steps 8

# Adjust an entire palette
aether --adjust-palette '["#0a180a","#a8ad42","#7cd480"]' --vibrance 20

# Analyze a palette
aether --palette-info '["#0a180a","#a8ad42","#7cd480","#a0c877","#53ba97","#7cc094","#8fd7b0","#a5baa7","#39513c","#a8ad42","#7cd480","#a0c877","#53ba97","#7cc094","#8fd7b0","#bed3c0"]'
```

Palette arguments accept either a JSON array or a blueprint name:

```sh
aether --palette-info "Nord"
```

### Blueprint Management

```sh
aether --list-blueprints
aether --show-blueprint "Nord"
aether --show-blueprint "Nord" --json
aether --delete-blueprint "Old Theme"
aether --export-blueprint "Nord"
aether --export-blueprint "Nord" --output ~/themes/nord.json
```

### Inspection

```sh
# List supported applications
aether --list-apps

# List extraction modes with descriptions
aether --list-modes

# Show all template variables for a source
aether --show-variables ~/wallpaper.jpg
aether --show-variables "Nord" --json

# Show the currently applied theme
aether --current-theme
aether --current-theme --json

# Preview what a specific app template would look like
aether --preview-template kitty ~/wallpaper.jpg
aether --preview-template alacritty "Nord"
```

### Wallpapers

```sh
aether --list-wallpapers
aether --random-wallpaper
aether --search-wallhaven "dark forest" --sorting relevance
aether --search-wallhaven "mountains" --purity 100 --at-least 1920x1080 --json
```

### Favorites

```sh
aether --list-favorites
aether --toggle-favorite ~/Wallpapers/forest.jpg
aether --is-favorite ~/Wallpapers/forest.jpg
```

## JSON Output

All commands support `--json` for machine-readable output. This is the primary interface for AI tools and scripts.

```sh
aether status --json
```

```json
{
  "ok": true,
  "palette": ["#0a180a", "#a8ad42", ...],
  "light_mode": false,
  "mode": "normal",
  "wallpaper": "/home/user/Wallpapers/forest.jpg"
}
```

Error responses:

```json
{"error": "blueprint not found"}
```

## IPC Protocol

The protocol is newline-delimited JSON over a Unix domain socket. Each request is a single JSON object followed by a newline. The server responds with a single JSON object followed by a newline.

### Request Format

```json
{"cmd": "status"}
{"cmd": "extract", "path": "/path/to/wallpaper.jpg", "mode": "pastel"}
{"cmd": "set-color", "index": 4, "value": "#53ba97"}
{"cmd": "adjust", "vibrance": 20, "contrast": 10}
{"cmd": "set-palette", "palette": ["#0a180a", ...]}
{"cmd": "apply"}
{"cmd": "load-blueprint", "name": "Nord"}
{"cmd": "toggle-light-mode"}
```

### Response Format

```json
{"ok": true, "palette": [...], "light_mode": false, "mode": "normal", "wallpaper": "..."}
{"ok": true}
{"ok": false, "error": "blueprint not found"}
```

## Socket Details

- **Path:** `~/.config/aether/aether.sock`
- **PID file:** `~/.config/aether/aether.sock.pid`
- **Permissions:** `0600` (owner only)
- **Created:** when the GUI starts
- **Removed:** when the GUI exits cleanly
- **Stale detection:** if Aether crashes, the next instance detects the stale socket via the PID file and cleans it up automatically

## Using with AI Assistants

Aether's CLI and IPC are designed to be used by AI coding assistants like Claude Code. An AI agent can:

- Query the current theme state with `aether status --json`
- Extract and analyze palettes from wallpapers without opening the GUI
- Adjust colors programmatically using perceptual color science (OKLab/OKLCH)
- Control the running editor in real time (change colors, move sliders, apply themes)
- Check accessibility compliance with `aether --contrast`
- Build complete themes from scratch using `--palette-from-color` or `--gradient`

### Example: AI-driven theme creation

```sh
# Extract colors from a wallpaper
aether extract ~/Wallpapers/sunset.jpg

# Check the result
aether status --json

# Boost warmth and vibrancy
aether adjust --temperature 15 --vibrance 10

# Verify contrast is accessible
aether --contrast "#1a1a2e" "#e0d4c8"

# Apply when satisfied
aether apply
```

### Example: Headless palette analysis

```sh
# Get color info in all formats
aether --color-info "#7cd480" --json

# Analyze a full palette
aether --palette-info "My Blueprint" --json

# Check which apps are supported
aether --list-apps --json
```

## Error Handling

If Aether is not running:

```
$ aether status
aether is not running (no socket at /home/user/.config/aether/aether.sock)
```

If a command fails:

```
$ aether load-blueprint "nonexistent"
Error: blueprint "nonexistent" not found
```

## Scripting Examples

```sh
# Extract and apply in one go
aether extract ~/wallpaper.jpg && aether apply

# Random wallpaper theme
aether extract "$(aether --random-wallpaper)" && aether apply

# Warm up the current palette
aether adjust --temperature 20 --vibrance 5

# Export current theme for sharing
aether --current-theme --json > my-theme.json
```
