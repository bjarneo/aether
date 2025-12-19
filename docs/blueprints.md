# Blueprints

Blueprints are saved theme configurations that you can restore anytime.

## What's Saved

A blueprint stores:

- **Wallpaper path** (local file or wallhaven URL)
- **16-color palette** (hex values)
- **Light/dark mode** setting
- **Timestamp** of creation

## Saving a Blueprint

1. Create your theme (wallpaper + colors)
2. Click **Save Blueprint** in the sidebar
3. Enter a name
4. Blueprint appears in the list

## Loading a Blueprint

1. Click a blueprint in the sidebar
2. Wallpaper loads (downloads if from wallhaven)
3. Colors restore to saved values
4. Light mode setting applies

## Storage Location

Blueprints are JSON files at:

```
~/.config/aether/blueprints/
├── my-theme.json
├── dark-forest.json
└── ocean-vibes.json
```

## Blueprint Format

```json
{
  "name": "My Theme",
  "timestamp": 1703001234567,
  "palette": {
    "wallpaper": "/path/to/wallpaper.jpg",
    "wallpaperUrl": "https://wallhaven.cc/...",
    "wallpaperSource": "wallhaven",
    "colors": ["#1a1b26", "#f7768e", ...],
    "lightMode": false
  }
}
```

## Tips

- Name blueprints descriptively (e.g., "Nord Dark", "Summer Vibes")
- Delete unused blueprints to keep the list clean
- Blueprints work across machines if wallpapers are accessible
