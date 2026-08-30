# File System Layout

Aether stores files in three standard XDG directories.

## Configuration (`~/.config/aether/`)

User settings and persistent data.

```
~/.config/aether/
├── blueprints/              # Saved theme blueprints
│   └── *.json               # Individual blueprint files
├── custom/                  # Custom app templates
│   └── appname/             # One folder per app
│       └── template.ext     # Template files with color variables
├── theme/                   # Generated theme output
│   ├── backgrounds/         # Wallpaper copies
│   └── *.conf               # Processed config files
├── favorites.json           # Favorited wallpapers list
├── settings.json            # App preferences
└── wallhaven.json           # Wallhaven API key and settings
```

### Key Files

| File | Purpose |
|------|---------|
| `blueprints/*.json` | Saved color schemes with wallpaper reference |
| `settings.json` | Light mode, template toggles, adjustments |
| `wallhaven.json` | API key for NSFW content access |
| `favorites.json` | List of favorited wallpaper paths/URLs |

## Cache (`~/.cache/aether/`)

Temporary and regeneratable files.

```
~/.cache/aether/
├── thumbnails/              # Local wallpaper thumbnails
├── wallhaven-thumbs/        # Wallhaven preview images
├── color-cache/             # Extracted color palettes
└── processed-wallpaper-*.jpg  # Edited wallpapers
```

These files can be safely deleted to free disk space.

## Data (`~/.local/share/aether/`)

Permanent user data.

```
~/.local/share/aether/
└── wallpapers/          # Downloaded wallhaven wallpapers
```

Downloaded wallpapers are kept permanently for offline access.

## Omarchy Integration

On Omarchy, Aether writes a native, managed theme instead of linking its standalone output:

```text
~/.config/omarchy/themes/aether/
|-- .aether-managed
|-- colors.toml
|-- backgrounds/
|-- preview.png
`-- supported per-app overrides
```

Theme activation runs through `omarchy theme set aether`. Omarchy remains responsible for its authoritative runtime state in `~/.local/state/omarchy/current/`, generating application configs, changing the background, reloading applications, and running hooks.

The optional shell selectors are installed in:

```text
~/.config/omarchy/plugins/aether.wallpapers/
~/.config/omarchy/plugins/aether.blueprints/
```

Aether only replaces theme and plugin directories containing its ownership marker. Existing third-party directories are left untouched.

## Cleaning Up

**Safe to delete:**
- `~/.cache/aether/` - Thumbnails and processed images

**Keep:**
- `~/.config/aether/blueprints/` - Your saved themes
- `~/.local/share/aether/wallpapers/` - Downloaded wallpapers

**Reset all settings:**
```bash
rm -rf ~/.config/aether ~/.cache/aether ~/.local/share/aether
```
