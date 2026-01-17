# Standalone Usage (Non-Omarchy Systems)

Aether can be used on any Linux system with GTK4/Libadwaita, not just Omarchy. When running outside of Omarchy, theme files are generated but not automatically applied system-wide.

## Theme Output Location

When you click "Apply Theme", Aether generates all theme files to:

```
~/.config/aether/theme/
```

### Directory Structure

```
~/.config/aether/theme/
├── backgrounds/          # Wallpaper copy
│   └── wallpaper.jpg
├── hyprland.conf         # Hyprland color config
├── kitty.conf            # Kitty terminal theme
├── waybar.css            # Waybar stylesheet
├── rofi.rasi             # Rofi launcher theme
├── gtk.css               # GTK theme (if enabled)
├── aether.override.css   # Aether app theme
├── neovim.lua            # Neovim colorscheme
├── vscode.json           # VSCode color theme
├── aether.zed.json       # Zed editor theme
└── ...                   # Other app configs
```

## Manual Integration

### Hyprland

Source the generated config in your `~/.config/hypr/hyprland.conf`:

```conf
source = ~/.config/aether/theme/hyprland.conf
```

### Kitty Terminal

Include the theme in your `~/.config/kitty/kitty.conf`:

```conf
include ~/.config/aether/theme/kitty.conf
```

### Waybar

Import the stylesheet in your Waybar config or use directly:

```css
@import url("file:///home/YOUR_USER/.config/aether/theme/waybar.css");
```

Or symlink it:

```bash
ln -sf ~/.config/aether/theme/waybar.css ~/.config/waybar/colors.css
```

### Rofi

Reference the theme in your rofi config:

```conf
@theme "~/.config/aether/theme/rofi.rasi"
```

### Neovim

Load the colorscheme in your Neovim config:

```lua
dofile(vim.fn.expand("~/.config/aether/theme/neovim.lua"))
```

### Wallpaper (swaybg)

Set the wallpaper manually:

```bash
swaybg -i ~/.config/aether/theme/backgrounds/wallpaper.jpg -m fill
```

Or add to your Hyprland config:

```conf
exec-once = swaybg -i ~/.config/aether/theme/backgrounds/wallpaper.jpg -m fill
```

## GTK Theming

If you enable "GTK Theme" in settings, Aether copies `gtk.css` to:
- `~/.config/gtk-3.0/gtk.css`
- `~/.config/gtk-4.0/gtk.css`

This applies the color scheme to GTK applications system-wide.

## Automatic Reload

For applications that support live reload, changes will apply immediately. Others may require:
- Restarting the application
- Reloading the config (e.g., `hyprctl reload` for Hyprland)

## Custom Templates

You can add custom application templates in:

```
~/.config/aether/custom/
```

See [CUSTOM_APPS.md](CUSTOM_APPS.md) for details on creating custom templates.
