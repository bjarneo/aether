# GitHub Source

Aether can browse image repositories on **GitHub** and use wallpapers directly from them — no cloning or manual download needed. Works with any public repo containing `.jpg`, `.jpeg`, `.png`, or `.webp` images.

## Features

- **Browse any public GitHub repo** by URL — supports `github.com`, `*.github.io` (GitHub Pages), and `raw.githubusercontent.com` links
- **Directory navigation** — click folders to navigate deeper, arrow button to go up
- **Thumbnails** — server-side generated 300px previews, cached to disk for instant repeat views
- **Name filter** — client-side text filter to narrow down results
- **Saved repos** — bookmark repos for quick access (stored in browser localStorage)
- **Favorites** — star individual wallpapers to add to the global Favorites tab
- **Additional images** — add wallpapers to the blend set for multi-image extraction
- **Wallpaper only** — apply a wallpaper without re-extracting the palette
- **Full-size preview** — overlay preview with next/previous navigation

## Usage

1. Open the **Sources** dropdown in the header bar and select **GitHub**
2. Paste a GitHub URL in the input field and click **Fetch**
   - Examples: `https://github.com/dharmx/walls`, `https://github.com/bjarneo/wallpapers/tree/gh-pages`
3. Browse images and directories
4. Click **Use** on any wallpaper to download it, set it as the current wallpaper, and switch to the Editor

## Supported URL Formats

| Format | Example |
|--------|---------|
| Repository root | `https://github.com/owner/repo` |
| With branch | `https://github.com/owner/repo/tree/main` |
| Subdirectory | `https://github.com/owner/repo/tree/main/wallpapers/nature` |
| Single file | `https://github.com/owner/repo/blob/main/image.jpg` |
| Without branch | `https://github.com/owner/repo/subdir` |
| GitHub Pages | `https://owner.github.io/wallpapers` |
| Raw URL | `https://raw.githubusercontent.com/owner/repo/branch/path` |

## Performance

- The **GitHub API** response is cached in memory for 5 minutes (100 entries max, LRU eviction)
- Thumbnails are generated server-side and cached to `~/.cache/aether/github/` as PNG files with a `.dims` sidecar for original dimensions
- The first 12 images in each fetch are **pre-warmed** in the thumbnail cache so they load instantly on scroll
- Images load lazily — only cards that scroll into view trigger thumbnail generation
