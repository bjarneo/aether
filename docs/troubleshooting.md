# Troubleshooting

## App Won't Start

```bash
# Ensure webkit2gtk is installed
sudo pacman -S webkit2gtk

# Run from terminal to see errors
./aether
```

## Wallhaven Not Loading

- Check internet connection
- Rate limit: 45 req/min without API key
- Add API key in Settings for higher limits
- Clear cache: `rm -rf ~/.cache/aether/wallhaven-*`

## Theme Not Applying

On Omarchy:

1. Check `~/.config/omarchy/themes/aether/` for `.aether-managed` and `colors.toml`.
2. Check the active theme with `cat ~/.local/state/omarchy/current/theme.name`.
3. Run `omarchy theme set aether` and inspect the reported error.

Without Omarchy, check `~/.config/aether/theme/` and the integration steps in the [standalone guide](standalone.md).

## Shell Selector Not Opening

```bash
omarchy plugin list
omarchy-shell shell rescanPlugins
omarchy plugin enable aether.wallpapers
omarchy plugin enable aether.blueprints
```

Reinstall missing plugins with `aether-install-omarchy-plugins`.

## Colors Look Wrong

- Try different extraction modes: `aether --generate wallpaper.jpg --extract-mode material`
- Check if image is too dark/bright for good extraction
- Use color adjustments in the sidebar
