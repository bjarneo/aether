<p align="center">
  <img src="icon.png" alt="Aether Icon" width="128" height="128">
</p>

# Aether - Universal Desktop Synthesizer

Aether is a beautiful GTK/Libadwaita application that provides real-time, visual control over your entire desktop aesthetic in Hyprland environments. Instead of editing text files, you sculpt your desktop's look and feel with interactive controls and see changes happen live.

## Features

### 🎨 Palette Generation (via pywal)
- Drop a wallpaper and Aether extracts 16 ANSI colors using pywal
- Automatic color analysis optimized for terminal and desktop themes
- Click any color swatch to fine-tune individual colors

### 🎛️ Color Palette Editor
- Edit all 16 ANSI terminal colors (0-15)
- Customize background and foreground colors
- Live color picker with palette preview
- Colors sync across all applications via omarchy templates

### 📦 Blueprint System
- Save your themes as shareable blueprints (JSON files)
- Quick theme switching with one click
- Browse and manage your collection in the sidebar
- Blueprints stored in `~/.config/aether/blueprints/`

### 🔄 Omarchy Integration
- Template-based theme generation
- One-click apply updates all applications instantly
- Non-destructive (doesn't modify your personal configs)
- Supports Hyprland, Waybar, Kitty, Rofi, Wofi, Walker, and more

## Requirements

- GJS (GNOME JavaScript bindings)
- GTK 4
- Libadwaita 1
- **pywal** - Color extraction from wallpapers
- **omarchy** - Theme manager for applying configs
- Hyprland (primary window manager)
- Optional: Waybar, Kitty, Rofi, Wofi, Walker

## Installation

1. Install system dependencies:
```bash
sudo pacman -S gjs gtk4 libadwaita python-pywal
# Install omarchy theme manager from AUR or your preferred method
```

2. Clone the repository:
```bash
cd ~/Code
git clone <your-repo-url> Aether
cd Aether
```

3. Make the launcher executable:
```bash
chmod +x aether
```

4. Run Aether:
```bash
./aether
```

5. (Optional) Install desktop entry:
```bash
cp com.aether.DesktopSynthesizer.desktop ~/.local/share/applications/
```

## Usage

### Getting Started

1. **Extract Colors**:
   - Click the folder icon or drag a wallpaper into the Generative Palette section
   - Aether uses pywal to extract 16 ANSI colors from the image
   - Colors appear in a visual palette below the wallpaper preview

2. **Customize Colors**:
   - Click any color swatch in the palette to open the color picker
   - The Color Palette section shows all 18 editable colors (background, foreground, color0-15)
   - Fine-tune individual colors using the color dialog

3. **Apply Theme**:
   - Click "Apply Theme" to generate theme files and apply via omarchy
   - Theme is created in `~/.config/omarchy/themes/aether/`
   - All configured applications update instantly via `omarchy-theme-set aether`

4. **Save & Share**:
   - Click "Save Blueprint" to preserve your theme configuration
   - Enter a name for your blueprint
   - Browse saved blueprints in the sidebar
   - Apply any blueprint with one click

### Supported Applications

Aether works via omarchy templates for:

- **Hyprland**: Window borders, colors, and styling
- **Waybar**: Status bar colors and styling
- **Kitty**: Terminal colors (full 16 ANSI palette)
- **Rofi**: Application launcher colors
- **Wofi**: Application launcher colors
- **Walker**: Application launcher colors
- Any other app with templates in `templates/` directory

### Theme Files

Aether uses a template-based system:

- Templates: `Aether/templates/*.conf` or `*.css`
- Output: `~/.config/omarchy/themes/aether/`
- Wallpaper: Copied to `~/.config/omarchy/themes/aether/backgrounds/`
- Your personal configs remain untouched

## Project Structure

```
Aether/
├── src/
│   ├── main.js                 # Main application window
│   ├── components/
│   │   ├── PaletteGenerator.js # Wallpaper selection & pywal integration
│   │   ├── ColorSynthesizer.js # 18-color palette editor
│   │   └── BlueprintManager.js # Theme save/load/apply
│   └── utils/
│       └── ConfigWriter.js     # Template processor & omarchy integration
├── templates/                  # Config templates with {variable} placeholders
│   ├── hyprland.conf
│   ├── kitty.conf
│   ├── waybar.css
│   └── ...
├── icon.png
├── aether                      # Launcher script
└── README.md
```

## Development

Run directly:
```bash
./aether
# or
gjs -m src/main.js
```

The app uses:
- **GJS**: GNOME JavaScript bindings
- **GTK 4**: Modern UI toolkit
- **Libadwaita**: GNOME's adaptive widgets
- **ES Modules**: Modern JavaScript

## Architecture

### Theme Application Flow

1. User selects wallpaper
2. Aether runs `wal -n -s -t -e -i <image>` to generate colors
3. Reads 16 colors from `~/.cache/wal/colors`
4. User customizes colors in the palette editor
5. Click "Apply Theme" triggers:
   - Create `~/.config/omarchy/themes/aether/` directory
   - Copy wallpaper to theme's `backgrounds/` folder
   - Process all templates in `templates/` directory
   - Replace `{variable}` placeholders with actual colors
   - Write processed configs to theme directory
   - Run `omarchy-theme-set aether` to apply

### Template System

Templates support these variable formats:
- `{background}`, `{foreground}` - Base colors
- `{color0}` through `{color15}` - ANSI colors
- `{color5.strip}` - Color without `#` prefix
- `{color5.rgb}` - Color as decimal RGB (e.g., `203,166,247`)

### Blueprint Storage

Blueprints are JSON files in `~/.config/aether/blueprints/`:
```json
{
  "name": "My Theme",
  "timestamp": 1234567890,
  "palette": {
    "wallpaper": "/path/to/wallpaper.png",
    "colors": ["#color0", "#color1", ...]
  },
  "colors": {
    "background": "#1e1e2e",
    "foreground": "#cdd6f4",
    "color0": "#45475a",
    ...
  }
}
```

## Troubleshooting

**App won't start:**
- Ensure GJS is installed: `pacman -S gjs gtk4 libadwaita`
- Check for GJS errors: `gjs -m src/main.js`

**pywal not found:**
- Install pywal: `pacman -S python-pywal`
- Verify: `which wal`

**omarchy-theme-set not found:**
- Install omarchy theme manager
- Verify: `which omarchy-theme-set`

**Colors not applying:**
- Check if omarchy is installed
- Manually apply: `omarchy-theme-set aether`
- Verify theme directory: `ls ~/.config/omarchy/themes/aether/`

**Templates not processing:**
- Ensure `templates/` directory exists in Aether project folder
- Check template files have `{variable}` placeholders

## Contributing

Aether is designed to be extensible:

1. **Add New Apps**: Create new template files in `templates/` directory
2. **Modify Color Mappings**: Edit `ColorSynthesizer.js` roles array
3. **Enhance UI**: Add new widgets to `main.js` or component files
4. **Template Variables**: Add new variable processing in `ConfigWriter.js`

## Philosophy

> From Configuration to Creation

Aether bridges the gap between pywal's automatic color extraction and manual config editing. It provides a visual interface to refine pywal's output and instantly apply coordinated themes across all your applications via omarchy.

The focus shifts from editing multiple config files to "Pick a wallpaper, tweak the colors, click apply."

## License

MIT

---

**Made with ❤️ for the Hyprland/Arch community**

*Absolute control, made beautiful and intuitive.*
