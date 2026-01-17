# Custom Templates

Override default templates or add support for new applications.

## Quick Start

```bash
mkdir -p ~/.config/aether/custom
```

Place your templates here. Aether prioritizes custom templates over defaults.

## Template Variables

| Variable | Output | Example |
|----------|--------|---------|
| `{background}` | Hex color | `#1e1e2e` |
| `{foreground}` | Hex color | `#cdd6f4` |
| `{color0}` - `{color15}` | ANSI colors | `#45475a` |
| `{red}`, `{green}`, etc. | Named colors | `#f38ba8` |
| `{accent}` | Accent/highlight color | `#89b4fa` |
| `{cursor}` | Cursor color | `#cdd6f4` |
| `{selection_foreground}` | Selected text color | `#1e1e2e` |
| `{selection_background}` | Selection highlight | `#cdd6f4` |

### Format Modifiers

| Modifier | Output | Example |
|----------|--------|---------|
| `{color.strip}` | Without `#` | `1e1e2e` |
| `{color.rgb}` | RGB values | `30, 30, 46` |
| `{color.rgba}` | RGBA | `rgba(30, 30, 46, 1)` |
| `{color.rgba:0.5}` | Custom alpha | `rgba(30, 30, 46, 0.5)` |

## Custom App with Symlinking

For apps not included by default, create a folder:

```
~/.config/aether/custom/myapp/
├── config.json      # Required
├── theme.conf       # Your template
└── post-apply.sh    # Optional script
```

### config.json

```json
{
  "template": "theme.conf",
  "destination": "~/.config/myapp/colors.conf"
}
```

### post-apply.sh (optional)

Runs after applying. Must be executable (`chmod +x`).

```bash
#!/bin/bash
pkill -USR1 myapp  # Reload app
```

## Example: Cava

See [examples/custom/apps/cava/](../examples/custom/apps/cava/) for a complete example.
