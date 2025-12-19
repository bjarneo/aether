# Wallhaven Integration

Aether integrates with [wallhaven.cc](https://wallhaven.cc) to browse and download high-quality wallpapers directly from the app.

## Features

- **Search wallpapers** by keywords, tags, or colors
- **Filter by category**: General, Anime, People
- **Sort options**: Date added, relevance, views, favorites, random
- **Resolution filter**: Set minimum resolution (e.g., 1920x1080)
- **Pagination**: Browse through results easily

## Setup

1. Click **Find Wallpaper** tab
2. Select **Wallhaven** sub-tab
3. (Optional) Click the gear icon to add your API key

## API Key (Optional)

An API key unlocks additional features:

- Access to NSFW content (if enabled in your wallhaven account)
- Higher rate limits
- Favorites sync

**Get your API key**: [wallhaven.cc/settings/account](https://wallhaven.cc/settings/account)

The key is stored locally at `~/.config/aether/wallhaven.json`.

## Search Tips

| Search | Description |
|--------|-------------|
| `mountain sunset` | Keywords |
| `#nature` | Tags |
| `@username` | Uploader |
| `id:123456` | Specific wallpaper |

## Rate Limits

- **Without API key**: 45 requests/minute
- **With API key**: Higher limits

## Workflow

1. Search or browse wallpapers
2. Click a wallpaper to select it
3. Wallpaper downloads to `~/.local/share/aether/wallpapers/`
4. Switches to Palette Editor for color extraction
5. Star icon adds to Favorites for quick access
