# Sharing Themes

## Community Platform

Share blueprints at [aethr.no](https://aethr.no/).

### Upload a Theme

1. Open Blueprint Manager (palette icon)
2. Click server icon in header
3. Enter your API key
4. Click menu (⋮) on any blueprint → "Post to Community"

Themes are posted as drafts for review before publishing.

## Protocol Links

One-click theme installation via `aether://` protocol.

### Create a Link

```
aether://import?url=https://example.com/theme.json
```

### Import via CLI

```bash
# Import from URL
aether --import-blueprint https://example.com/theme.json

# Import and apply immediately
aether --import-blueprint https://example.com/theme.json --auto-apply

# Import local file
aether --import-blueprint /path/to/theme.json
```

## Blueprint Format

```json
{
  "name": "My Theme",
  "timestamp": 1234567890,
  "palette": {
    "wallpaper": "/path/to/wallpaper.png",
    "lightMode": false,
    "colors": ["#1e1e2e", "#f38ba8", "..."]
  }
}
```

Blueprints are stored in `~/.config/aether/blueprints/`.
