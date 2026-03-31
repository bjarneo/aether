# Command Line Interface

Aether provides a full CLI for scripting, automation, and headless theme management.

## Quick Reference

```bash
# List saved themes
aether --list-blueprints

# Apply a saved theme
aether --apply-blueprint "my-theme"

# Generate theme from wallpaper (images and videos)
aether --generate ~/Wallpapers/sunset.jpg
aether --generate ~/Wallpapers/animated.mp4

# Import Base16 color scheme
aether --import-base16 ~/themes/dracula.yaml

# Import colors.toml (omarchy/ethereal format)
aether --import-colors-toml ~/themes/colors.toml
```

## Commands

### List Blueprints

List all saved blueprint themes:

```bash
aether --list-blueprints
```

Output shows theme names and timestamps.

### Apply Blueprint

Apply a saved theme by name:

```bash
aether --apply-blueprint "theme-name"
```

This loads the blueprint and applies all configurations without opening the GUI.

### Generate Theme

Extract colors from a wallpaper and apply as theme:

```bash
aether --generate /path/to/wallpaper.jpg
```

**Options:**

| Option | Description |
|--------|-------------|
| `--light-mode` | Generate light theme instead of dark |
| `--extract-mode MODE` | Color extraction algorithm (see below) |
| `--no-apply` | Generate templates only, don't activate theme |
| `--output PATH` | Custom output directory (use with `--no-apply`) |

**Extraction Modes:**

- `normal` (default) - Balanced extraction
- `monochromatic` - Single-hue variations
- `analogous` - Adjacent colors on color wheel
- `pastel` - Soft, muted colors
- `material` - Google Material-inspired
- `colorful` - High saturation, vibrant
- `muted` - Desaturated, subtle
- `bright` - High brightness colors

**Examples:**

```bash
# Light theme with pastel colors
aether --generate ~/wallpaper.jpg --light-mode --extract-mode pastel

# Vibrant colorful theme
aether --generate ~/wallpaper.jpg --extract-mode colorful

# Generate templates without applying (no symlinks, no theme activation)
aether --generate ~/wallpaper.jpg --no-apply

# Generate to custom directory for use with external scripts
aether --generate ~/wallpaper.jpg --no-apply --output ~/my-themes/generated
```

### Import Blueprint

Import a theme from URL or local file:

```bash
aether --import-blueprint "https://example.com/blueprint.json"
aether --import-blueprint "/path/to/theme.json"
```

**Options:**

| Option | Description |
|--------|-------------|
| `--auto-apply` | Apply immediately after importing |

**Example:**

```bash
# Import and apply in one command
aether --import-blueprint "https://example.com/blueprint.json" --auto-apply
```

### Import Base16 Scheme

Import a [Base16](https://github.com/chriskempson/base16) color scheme:

```bash
aether --import-base16 /path/to/scheme.yaml
```

**Options:**

| Option | Description |
|--------|-------------|
| `--wallpaper FILE` | Include wallpaper with the theme |
| `--light-mode` | Generate light theme variant |

**Examples:**

```bash
# Import Base16 scheme
aether --import-base16 ~/themes/dracula.yaml

# Import with wallpaper
aether --import-base16 ~/themes/nord.yaml --wallpaper ~/wallpaper.jpg

# Import as light theme
aether --import-base16 ~/themes/solarized.yaml --light-mode
```

Base16 schemes are available from [tinted-theming/schemes](https://github.com/tinted-theming/schemes) (250+ schemes).

See [Base16 documentation](base16.md) for format details and color mapping.

### Import Colors.toml

Import a flat colors.toml file (compatible with omarchy/ethereal themes):

```bash
aether --import-colors-toml /path/to/colors.toml
```

**Options:**

| Option | Description |
|--------|-------------|
| `--wallpaper FILE` | Include wallpaper with the theme |
| `--light-mode` | Generate light theme variant |

**Examples:**

```bash
# Import colors.toml
aether --import-colors-toml ~/.local/share/omarchy/themes/ethereal/colors.toml

# Import with wallpaper
aether --import-colors-toml ~/themes/colors.toml --wallpaper ~/wallpaper.jpg
```

The colors.toml format uses a flat structure with color0-color15, plus extended colors:

```toml
accent = "#7d82d9"
cursor = "#ffcead"
foreground = "#ffcead"
background = "#060B1E"
selection_foreground = "#060B1E"
selection_background = "#ffcead"
color0 = "#060B1E"
color1 = "#ff6188"
# ... color2-color14
color15 = "#ffcead"
```

### Blueprint Widget

Show floating theme selector widget:

```bash
aether --widget-blueprint
```

Useful for quick theme switching from a keybind.

### Wallpaper Slider Widget

Full-screen overlay slider for browsing and applying wallpapers with material color extraction:

```bash
aether --widget-wallpaper-slider
```

### Themes Slider Widget

Full-screen overlay slider for browsing and applying system themes:

```bash
aether --widget-themes-slider
```

**Controls:**

| Key | Action |
|-----|--------|
| Tab / Arrow Right | Next slide |
| Shift+Tab / Arrow Left | Previous slide |
| Hold Tab | Fast scroll (accelerates the longer you hold) |
| Enter | Apply current theme |
| Escape | Close |
| Type characters | Search by filename/theme name |

**Hyprland configuration:**

For the slider widgets to display as transparent overlays, add to your Hyprland config (adjust `size` to your monitor resolution):

```conf
# Aether slider widgets (wallpaper + themes)
windowrule = match:class aether-slider, float 1
windowrule = match:class aether-slider, pin 1
windowrule = match:class aether-slider, no_shadow 1
windowrule = match:class aether-slider, decorate 0
windowrule = match:class aether-slider, size 2880 1800  # replace with your monitor resolution
windowrule = match:class aether-slider, center 1
```

**Keybind examples:**

```conf
bind = SUPER ALT, W, exec, aether --widget-wallpaper-slider
bind = SUPER ALT, T, exec, aether --widget-themes-slider
```

### Open with Tab

Launch GUI with a specific tab focused:

```bash
aether --tab <name>
```

## aether-wp

`aether-wp` is a standalone binary for animated (live) wallpapers. It uses GStreamer and GTK Layer Shell to render video or GIF files directly on the Wayland desktop background layer.

```bash
aether-wp /path/to/video.mp4
aether-wp --cpu /path/to/video.mp4
aether-wp --stop
```

| Flag | Description |
|------|-------------|
| `--stop` | Stop any running aether-wp instance and clean up the layer surface |
| `--cpu` | Force CPU rendering (skip GPU-accelerated OpenGL sink) |

Aether launches `aether-wp` automatically when you apply a theme with an animated wallpaper (`.mp4`, `.webm`, `.gif`). You can also run it standalone.

**How it works:**

- Renders on the background layer via `gtk-layer-shell` (replaces `swaybg`)
- GPU-accelerated playback using `gtkglsink` (OpenGL), auto-falls back to `gtksink` (CPU)
- Frame rate capped at 30fps to reduce GPU load
- Loops automatically on end-of-stream
- Muted audio (audio decoding disabled entirely)
- PID file at `$XDG_RUNTIME_DIR/aether-wp.pid` for reliable process management
- Handles `SIGTERM`/`SIGINT` for clean shutdown (tears down layer surface properly)

**Requirements:**

- Wayland compositor with layer-shell support (Hyprland, Sway, etc.)
- `gtk-layer-shell`
- GStreamer with GTK sink (`gst-plugins-good` or `gst-plugin-gtk`)

**Binary lookup order:**

1. Same directory as the `aether` binary
2. `$PATH`

When applying a static wallpaper, Aether automatically kills any running `aether-wp` process and falls back to `swaybg`.

## Scripting Examples

### Theme Rotation Script

```bash
#!/bin/bash
# Rotate through themes by time of day

themes=("morning" "afternoon" "evening" "night")
hour=$(date +%H)

if [ $hour -lt 6 ]; then
    aether --apply-blueprint "${themes[3]}"
elif [ $hour -lt 12 ]; then
    aether --apply-blueprint "${themes[0]}"
elif [ $hour -lt 18 ]; then
    aether --apply-blueprint "${themes[1]}"
else
    aether --apply-blueprint "${themes[2]}"
fi
```

### Random Wallpaper Theme

```bash
#!/bin/bash
# Generate theme from random wallpaper

wallpaper=$(find ~/Wallpapers -type f \( -name "*.jpg" -o -name "*.png" \) | shuf -n 1)
aether --generate "$wallpaper"
```

### Hyprland Keybind

Add to `~/.config/hypr/hyprland.conf`:

```conf
# Slider widgets
bind = SUPER ALT, W, exec, aether --widget-wallpaper-slider
bind = SUPER ALT, T, exec, aether --widget-themes-slider

# Quick theme selector widget
bind = SUPER ALT, B, exec, aether --widget-blueprint

# Generate theme from current wallpaper
bind = $mainMod ALT, T, exec, aether --generate $(hyprctl hyprpaper listactive | head -1 | cut -d' ' -f2)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (file not found, invalid blueprint, etc.) |

## Environment Variables

Aether respects standard XDG directories:

- `~/.config/aether/` - Configuration and blueprints
- `~/.cache/aether/` - Thumbnails and temporary files
- `~/.local/share/aether/` - Downloaded wallpapers
