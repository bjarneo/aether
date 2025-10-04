<p align="center">
  <img src="icon.png" alt="Aether Icon" width="128" height="128">
</p>

# Aether Quick Start Guide

## Installation

1. **Install dependencies:**
```bash
sudo pacman -S gjs gtk4 libadwaita python-pywal
# Install omarchy from AUR or your preferred method
```

2. **Navigate to Aether:**
```bash
cd ~/Code/Aether
```

3. **Make executable and run:**
```bash
chmod +x aether
./aether
```

## First Steps

### 1. Extract Colors from Wallpaper
- Click the **folder icon** in the "Generative Palette" section
- Select a wallpaper image (PNG, JPEG, or WebP)
- Aether runs pywal to automatically extract 16 ANSI colors
- Colors appear in a visual palette below the wallpaper preview

### 2. Customize Colors (Optional)
- Click any **color swatch** in the palette to open the color picker
- The **Color Palette** section shows all 18 editable colors:
  - **Background**: Primary background color
  - **Foreground**: Primary text color
  - **color0-15**: Full ANSI terminal color palette
- Fine-tune individual colors to your liking

### 3. Apply Your Theme
- Click **"Apply Theme"** button at the bottom
- Aether will:
  - Create theme in `~/.config/omarchy/themes/aether/`
  - Process all templates with your colors
  - Copy wallpaper to theme directory
  - Run `omarchy-theme-set aether` to apply
- All configured applications update instantly!

### 4. Save Your Creation
- Click **"Save Blueprint"** to preserve your configuration
- Enter a name for your theme
- Blueprints are saved to `~/.config/aether/blueprints/`

### 5. Browse & Apply Blueprints
- The left sidebar shows all your saved blueprints
- Click **"Apply"** on any blueprint to load its colors
- Then click **"Apply Theme"** to activate it
- Click the trash icon to delete unwanted blueprints

## Supported Applications

Aether uses omarchy templates to configure:

### ✅ Hyprland
- Window border colors
- Styling and theming
- Applied via omarchy

### ✅ Waybar
- Status bar colors
- Styling
- Applied via omarchy

### ✅ Kitty
- Terminal colors (full 16 ANSI colors)
- Applied via omarchy

### ✅ Rofi / Wofi / Walker
- Application launcher colors
- Applied via omarchy

### ✅ Any App with Templates
- Add templates to `Aether/templates/`
- Use `{variable}` placeholders
- Automatically processed on theme apply

## How It Works

**Template System:**
- Templates are in `Aether/templates/` directory
- Use placeholders like `{background}`, `{color1}`, `{color5.strip}`
- Aether processes templates and outputs to `~/.config/omarchy/themes/aether/`
- `omarchy-theme-set aether` applies all configs at once

**Your Personal Configs:**
- Remain completely untouched
- No backups needed
- No marker blocks
- Non-destructive workflow

## Troubleshooting

### App won't start
```bash
# Check GJS installation
which gjs

# Install missing dependencies
sudo pacman -S gjs gtk4 libadwaita
```

### pywal not working
```bash
# Install pywal
sudo pacman -S python-pywal

# Test pywal
wal -i /path/to/image.png
cat ~/.cache/wal/colors
```

### omarchy not found
```bash
# Check if installed
which omarchy-theme-set

# Install from AUR or your package manager
# Example: yay -S omarchy
```

### Theme not applying
```bash
# Check theme directory
ls ~/.config/omarchy/themes/aether/

# Manually apply theme
omarchy-theme-set aether

# Check for errors
journalctl -f
```

### Colors look wrong
1. Try a different wallpaper with more color variety
2. Manually adjust colors using the color picker
3. Click "Apply Theme" again after adjustments

## Tips & Tricks

1. **Choose Colorful Wallpapers**: pywal extracts better colors from images with variety. Dark/monochrome images may produce limited palettes.

2. **Fine-Tune Colors**: pywal's automatic extraction is a starting point. Click any color swatch to adjust it to your preference.

3. **Terminal Colors**: If terminal colors look odd, manually adjust them in the Color Palette section. Not all wallpapers have good representation of all hues.

4. **Share Blueprints**: Blueprint files are just JSON! Share `~/.config/aether/blueprints/*.json` with friends.

5. **Add Custom Apps**: Create template files in `templates/` directory using `{variable}` placeholders for your favorite apps.

6. **Template Variables**: Available formats:
   - `{color5}` - Full hex color like `#cba6f7`
   - `{color5.strip}` - Without `#` like `cba6f7`
   - `{color5.rgb}` - Decimal RGB like `203,166,247`

## Desktop Entry (Optional)

To launch from your app menu:
```bash
cp com.aether.DesktopSynthesizer.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

## Keyboard Shortcuts

Within Aether:
- `Ctrl+Q`: Quit application (if the app supports it)
- Mouse wheel on sliders: Fine-tune values

---

**Enjoy your perfectly unified desktop aesthetic! 🎨✨**
