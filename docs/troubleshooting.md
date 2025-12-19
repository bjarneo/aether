# Troubleshooting

## App Won't Start

```bash
# Install dependencies
sudo pacman -S gjs gtk4 libadwaita libsoup3

# Check for errors
gjs -m src/main.js
```

## ImageMagick Not Found

```bash
sudo pacman -S imagemagick
magick --version
```

## Wallhaven Not Loading

- Check internet connection
- Rate limit: 45 req/min without API key
- Add API key in Settings for higher limits
- Clear cache: `rm -rf ~/.cache/aether/wallhaven-*`

## Waybar Disappears (Widget Mode)

When using `--widget-blueprint`, Aether runs with layer-shell which can conflict with Waybar.

**Solution:** Already fixed in Aether — it clears `LD_PRELOAD` when applying themes.

## Theme Not Applying

1. Check `~/.config/aether/theme/` for generated files
2. Verify symlink: `ls -la ~/.config/omarchy/themes/aether/`
3. Run manually: `omarchy-theme-set aether`

## Colors Look Wrong

- Try different extraction modes: `aether -g wallpaper.jpg --extract-mode=material`
- Check if image is too dark/bright for good extraction
- Use color adjustments in Settings sidebar
