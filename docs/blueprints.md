# Blueprints

Blueprints are saved theme configurations that you can restore anytime.

## What's Saved

A blueprint stores:

- **16-color palette** (hex values)
- **Extended colors** (accent, cursor, selection)
- **Wallpaper path** (local file or wallhaven URL)
- **Color adjustments** (all slider values)
- **App overrides** (per-app color customizations)
- **Settings** (which apps to include)
- **Light/dark mode** setting
- **Locked colors** (which colors to preserve during re-extraction)

## Saving a Blueprint

1. Create your theme (wallpaper + colors)
2. Click **Save Blueprint** in the sidebar
3. Enter a name
4. Blueprint appears in the list

## Loading a Blueprint

1. Click a blueprint in the sidebar
2. Wallpaper loads (downloads if from wallhaven)
3. Colors restore to saved values
4. All adjustments and settings apply

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
    "colors": ["#1a1b26", "#f7768e", "..."],
    "wallpaper": "/path/to/wallpaper.jpg",
    "wallpaperUrl": "https://wallhaven.cc/...",
    "lightMode": false,
    "extendedColors": {
      "accent": "#89b4fa",
      "cursor": "#cdd6f4",
      "selection_foreground": "#1e1e2e",
      "selection_background": "#cdd6f4"
    },
    "lockedColors": [0, 15]
  },
  "adjustments": {
    "vibrance": 10,
    "contrast": 5
  },
  "settings": {
    "includeNeovim": true,
    "includeGtk": false
  }
}
```

## Tips

- Name blueprints descriptively (e.g., "Nord Dark", "Summer Vibes")
- Delete unused blueprints to keep the list clean
- Blueprints work across machines if wallpapers are accessible
