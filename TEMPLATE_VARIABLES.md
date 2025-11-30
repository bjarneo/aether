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

