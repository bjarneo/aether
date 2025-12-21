# Command Line Interface

Aether provides a full CLI for scripting, automation, and headless theme management.

## Quick Reference

```bash
# List saved themes
aether --list-blueprints

# Apply a saved theme
aether --apply-blueprint "my-theme"

# Generate theme from wallpaper
aether --generate ~/Wallpapers/sunset.jpg

# Import Base16 color scheme
aether --import-base16 ~/themes/dracula.yaml

# Open GUI with specific wallpaper
aether --wallpaper ~/Wallpapers/sunset.jpg
```

## Commands

### List Blueprints

List all saved blueprint themes:

```bash
aether --list-blueprints
aether -l
```

Output shows theme names and timestamps.

### Apply Blueprint

Apply a saved theme by name:

```bash
aether --apply-blueprint "theme-name"
aether -a "theme-name"
```

This loads the blueprint and applies all configurations without opening the GUI.

### Generate Theme

Extract colors from a wallpaper and apply as theme:

```bash
aether --generate /path/to/wallpaper.jpg
aether -g /path/to/wallpaper.jpg
```

**Options:**

| Option | Description |
|--------|-------------|
| `--light-mode` | Generate light theme instead of dark |
| `--extract-mode MODE` | Color extraction algorithm (see below) |

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
```

### Import Blueprint

Import a theme from URL or local file:

```bash
aether --import-blueprint "https://aethr.no/api/blueprint/abc123"
aether -i "/path/to/theme.json"
```

**Options:**

| Option | Description |
|--------|-------------|
| `--auto-apply` | Apply immediately after importing |

**Example:**

```bash
# Import and apply in one command
aether --import-blueprint "https://aethr.no/api/blueprint/abc123" --auto-apply
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

### Open with Wallpaper

Launch GUI pre-loaded with a wallpaper:

```bash
aether --wallpaper /path/to/wallpaper.jpg
aether -w /path/to/wallpaper.jpg
```

### Blueprint Widget

Show floating theme selector widget:

```bash
aether --widget-blueprint
```

Useful for quick theme switching from a keybind.

## Scripting Examples

### Theme Rotation Script

```bash
#!/bin/bash
# Rotate through themes daily

themes=("morning" "afternoon" "evening" "night")
hour=$(date +%H)

if [ $hour -lt 6 ]; then
    aether -a "${themes[3]}"
elif [ $hour -lt 12 ]; then
    aether -a "${themes[0]}"
elif [ $hour -lt 18 ]; then
    aether -a "${themes[1]}"
else
    aether -a "${themes[2]}"
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
# Quick theme selector widget
bind = $mainMod SHIFT, T, exec, aether --widget-blueprint

# Generate theme from current wallpaper
bind = $mainMod ALT, T, exec, aether --generate $(hyprctl hyprpaper listactive | head -1 | cut -d' ' -f2)
```

## Protocol Handler

Aether registers the `aether://` protocol for one-click theme imports:

```
aether://import?url=https://aethr.no/api/blueprint/abc123
```

This is used by the [Aether Community](https://aethr.no) for sharing themes.

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
