# Custom Apps & Template Variables Guide

Aether uses a template system to generate configuration files for various applications. This guide lists the available variables you can use when creating or modifying templates in `~/.config/aether/custom/`.

## Basic Syntax

Variables are enclosed in curly braces, e.g., `{background}`.

## Available Color Variables

The following color variables are available for use in templates:

| Variable | Description | Typical Use |
|----------|-------------|-------------|
| `{background}` | Primary background color | Window backgrounds, panels |
| `{foreground}` | Primary text color | Main text content |
| `{black}` | Black (ANSI 0) | Normal black |
| `{red}` | Red (ANSI 1) | Errors, warnings |
| `{green}` | Green (ANSI 2) | Success, confirmations |
| `{yellow}` | Yellow (ANSI 3) | Warnings, highlights |
| `{blue}` | Blue (ANSI 4) | Info, links |
| `{magenta}` | Magenta (ANSI 5) | Constants, special elements |
| `{cyan}` | Cyan (ANSI 6) | Strings, secondary info |
| `{white}` | White (ANSI 7) | Regular text |
| `{bright_black}` | Bright Black (ANSI 8) | Comments, dimmed text |
| `{bright_red}` | Bright Red (ANSI 9) | Critical errors |
| `{bright_green}` | Bright Green (ANSI 10) | Emphasized success |
| `{bright_yellow}` | Bright Yellow (ANSI 11) | Important warnings |
| `{bright_blue}` | Bright Blue (ANSI 12) | Active links |
| `{bright_magenta}` | Bright Magenta (ANSI 13) | Focused elements |
| `{bright_cyan}` | Bright Cyan (ANSI 14) | Important data |
| `{bright_white}` | Bright White (ANSI 15) | Bold text, headings |

## Format Modifiers

You can transform color values using modifiers appended to the variable name.

### 1. Standard Hex (Default)
Output: `#RRGGBB`
Usage: `{background}`, `{red}`

### 2. Strip Hash
Removes the `#` prefix.
Output: `RRGGBB`
Usage: `{background.strip}`, `{red.strip}`

### 3. RGB Decimal
Converts to comma-separated decimal RGB values.
Output: `R, G, B` (e.g., `255, 100, 50`)
Usage: `{background.rgb}`, `{red.rgb}`

### 4. RGBA
Converts to CSS `rgba()` format.

**Default Alpha (1.0):**
Output: `rgba(R, G, B, 1)`
Usage: `{background.rgba}`

**Custom Alpha:**
Output: `rgba(R, G, B, 0.5)`
Usage: `{background.rgba:0.5}`, `{red.rgba:0.8}`

### 5. Yaru Theme
Maps the color to the closest Ubuntu Yaru icon theme variant.
Output: `Yaru`, `Yaru-blue`, `Yaru-red`, etc.
Usage: `{red.yaru}`

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
selection = {blue.rgb}
# Use RGBA with transparency
overlay = {black.rgba:0.8}

[Terminal]
# Standard hex values
black = {black}
red = {red}
green = {green}
```

## Custom Templates

All custom templates go in `~/.config/aether/custom/`.

### Folder Structure

```
~/.config/aether/custom/
├── hyprlock.conf            # Override default templates
├── waybar.css
├── cava/                    # Custom app with symlinking
│   ├── config.json
│   ├── theme.ini
│   └── post-apply.sh
└── another-app/
    ├── config.json
    └── template.conf
```

### Template Overrides

To override a default template, simply place your version in `~/.config/aether/custom/`:

```bash
mkdir -p ~/.config/aether/custom
# Copy and edit a template
cp /path/to/aether/templates/hyprlock.conf ~/.config/aether/custom/
```

### Custom App Templates

For apps not included in Aether, create a folder with `config.json`:

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

`~/.config/aether/custom/cava/config.json`:
```json
{
    "template": "theme.ini",
    "destination": "~/.config/cava/themes/aether"
}
```

`~/.config/aether/custom/cava/theme.ini`:
```ini
[color]
background = 'default'
foreground = '{magenta}'

gradient = 1
gradient_color_1 = '{blue}'
gradient_color_2 = '{magenta}'
gradient_color_3 = '{cyan}'
```

`~/.config/aether/custom/cava/post-apply.sh`:
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

The `examples/custom/` folder contains ready-to-use examples:

- **[demo.txt](examples/custom/demo.txt)** - Comprehensive example showing all variables and modifiers
- **[apps/cava/](examples/custom/apps/cava/)** - Complete custom app example with:
  - `config.json` - Template and destination configuration
  - `theme.ini` - Cava theme template with gradient colors
  - `post-apply.sh` - Script to set the theme in cava config and reload

To use the Cava example:
```bash
mkdir -p ~/.config/aether/custom
cp -r examples/custom/apps/* ~/.config/aether/custom/
```
