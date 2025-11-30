# Template Variables Guide

Aether uses a template system to generate configuration files for various applications. This guide lists the available variables you can use when creating or modifying templates in `~/aether-templates/`.

## Basic Syntax

Variables are enclosed in curly braces, e.g., `{background}`.

## Available Color Variables

The following color roles are available for use in templates:

| Variable | Description | Typical Use |
|----------|-------------|-------------|
| `{background}` | Primary background color | Window backgrounds, panels |
| `{foreground}` | Primary text color | Main text content |
| `{color0}` | Black (ANSI 0) | Normal black |
| `{color1}` | Red (ANSI 1) | Errors, warnings |
| `{color2}` | Green (ANSI 2) | Success, confirmations |
| `{color3}` | Yellow (ANSI 3) | Warnings, highlights |
| `{color4}` | Blue (ANSI 4) | Info, links |
| `{color5}` | Magenta (ANSI 5) | Constants, special elements |
| `{color6}` | Cyan (ANSI 6) | Strings, secondary info |
| `{color7}` | White (ANSI 7) | Regular text |
| `{color8}` | Bright Black (ANSI 8) | Comments, dimmed text |
| `{color9}` | Bright Red (ANSI 9) | Critical errors |
| `{color10}` | Bright Green (ANSI 10) | Emphasized success |
| `{color11}` | Bright Yellow (ANSI 11) | Important warnings |
| `{color12}` | Bright Blue (ANSI 12) | Active links |
| `{color13}` | Bright Magenta (ANSI 13) | Focused elements |
| `{color14}` | Bright Cyan (ANSI 14) | Important data |
| `{color15}` | Bright White (ANSI 15) | Bold text, headings |

## Format Modifiers

You can transform color values using modifiers appended to the variable name.

### 1. Standard Hex (Default)
Output: `#RRGGBB`
Usage: `{background}`, `{color1}`

### 2. Strip Hash
Removes the `#` prefix.
Output: `RRGGBB`
Usage: `{background.strip}`, `{color1.strip}`

### 3. RGB Decimal
Converts to comma-separated decimal RGB values.
Output: `R, G, B` (e.g., `255, 100, 50`)
Usage: `{background.rgb}`, `{color1.rgb}`

### 4. RGBA
Converts to CSS `rgba()` format.

**Default Alpha (1.0):**
Output: `rgba(R, G, B, 1)`
Usage: `{background.rgba}`

**Custom Alpha:**
Output: `rgba(R, G, B, 0.5)`
Usage: `{background.rgba:0.5}`, `{color1.rgba:0.8}`

### 5. Yaru Theme
Maps the color to the closest Ubuntu Yaru icon theme variant.
Output: `Yaru`, `Yaru-blue`, `Yaru-red`, etc.
Usage: `{color1.yaru}`

## Other Variables

| Variable | Description | Values |
|----------|-------------|--------|
| `{theme_type}` | The current theme mode | `light` or `dark` |
| `{wallpaper}` | Path to the generated wallpaper | Absolute file path |

## Example Template

Here is an example of a hypothetical config file using these variables:

```ini
[General]
# Use stripped hex for specific app format
base_color = {background.strip}
text_color = {foreground.strip}

[Highlight]
# Use RGB format
selection = {color4.rgb}
# Use RGBA with transparency
overlay = {color0.rgba:0.8}

[Terminal]
# Standard hex values
black = {color0}
red = {color1}
green = {color2}
```

## Custom App Templates

You can create app-specific templates with automatic symlinking and post-apply scripts using the `apps/` folder structure.

### Folder Structure

```
~/aether-templates/
├── apps/
│   ├── cava/
│   │   ├── config.json      # Required: template and destination
│   │   ├── theme.ini        # Your template file
│   │   └── post-apply.sh    # Optional: runs after symlinking
│   └── another-app/
│       ├── config.json
│       └── template.conf
├── waybar.css               # Override default templates
├── hyprlock.conf
└── ...
```

### config.json

Each app folder must contain a `config.json`:

```json
{
    "template": "theme.ini",
    "destination": "~/.config/cava/themes/aether"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `template` | Yes | Filename of the template in this folder |
| `destination` | Yes | Target path for the symlink (supports `~`) |

### post-apply.sh

Optional script that runs after the symlink is created. Must be executable (`chmod +x`).

### How It Works

1. Aether processes the template with color variables
2. Writes the result to `~/.config/omarchy/themes/aether/{appname}-{template}`
3. Creates a symlink from that file to your destination
4. Runs `post-apply.sh` if it exists

### Example: Cava Theme

`~/aether-templates/apps/cava/config.json`:
```json
{
    "template": "theme.ini",
    "destination": "~/.config/cava/themes/aether"
}
```

`~/aether-templates/apps/cava/theme.ini`:
```ini
[color]
gradient = 1
gradient_count = 8
gradient_color_1 = '#{color6.strip}'
gradient_color_2 = '#{color4.strip}'
gradient_color_3 = '#{color12.strip}'
gradient_color_4 = '#{color5.strip}'
gradient_color_5 = '#{color13.strip}'
gradient_color_6 = '#{color14.strip}'
gradient_color_7 = '#{color13.strip}'
gradient_color_8 = '#{color6.strip}'
```

`~/aether-templates/apps/cava/post-apply.sh`:
```bash
#!/bin/bash

config_file="$HOME/.config/cava/config"

if [ ! -f "$config_file" ]; then
    exit 0
fi

# Set theme = 'aether' in cava config
if ! grep -q "^theme = 'aether'" "$config_file"; then
    sed -i "/^theme = /d" "$config_file"
    sed -i "/^\[color\]/a theme = 'aether'" "$config_file"
fi

# Reload cava
pgrep -x cava && pkill -USR2 cava
```

## Examples

The `examples/aether-templates/` folder contains ready-to-use examples:

- **[demo.txt](examples/aether-templates/demo.txt)** - Comprehensive example showing all variables and modifiers
- **[apps/cava/](examples/aether-templates/apps/cava/)** - Complete custom app example with:
  - `config.json` - Template and destination configuration
  - `theme.ini` - Cava theme template with gradient colors
  - `post-apply.sh` - Script to set the theme in cava config and reload

To use the Cava example:
```bash
cp -r examples/aether-templates/apps ~/aether-templates/
```
