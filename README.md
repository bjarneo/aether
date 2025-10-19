<p align="center">
  <img src="icon.png" alt="Aether Icon" width="256" height="256">
</p>

https://github.com/user-attachments/assets/d0571670-e98f-4717-834c-34d6a2ec53f1

# Aether

A visual theming application for Omarchy. Create beautiful desktop themes through real-time color manipulation, wallpaper integration, and template-based theme generation.

## Key Features

- **Intelligent Color Extraction** - Advanced ImageMagick-based algorithm with automatic image classification (monochrome, low-diversity, chromatic)
- **Smart Palette Generation** - Adaptive strategies ensure readability and preserve image aesthetics
- **Image Filter Editor** - Apply blur, exposure, vignette, grain, and 12 presets before color extraction
- **Wallpaper Browsing** - Integrated wallhaven.cc browser, local wallpaper manager, and favorites system
- **Color Presets** - 10 popular themes: Dracula, Nord, Gruvbox, Tokyo Night, Catppuccin, and more
- **Advanced Color Tools** - Harmony generator, gradients, and adjustment sliders (vibrance, contrast, temperature)
- **Color Lock System** - Protect specific colors while experimenting with adjustments
- **Blueprint System** - Save and share themes as JSON files
- **Neovim Themes** - 37 LazyVim-compatible themes with preset matching
- **Accessibility Checker** - Real-time WCAG contrast ratio validation
- **Customizable UI** - Live theme reload and CSS variable system
- **Multi-App Support** - Hyprland, Waybar, Kitty, Alacritty, btop, Mako, and 15+ more applications

## Requirements

- GJS (GNOME JavaScript bindings)
- GTK 4
- Libadwaita 1
- libsoup3 - HTTP client library for wallhaven API
- **ImageMagick** - Intelligent color extraction and image filter processing
- **Omarchy** - Distro

## Installation

1. Install system dependencies:
```bash
sudo pacman -S gjs gtk4 libadwaita libsoup3 imagemagick
```

2. Clone the repository:
```bash
git clone https://github.com/bjarneo/aether.git
cd aether
```

3. Run Aether:
```bash
./aether
```

To open with a specific wallpaper:
```bash
./aether --wallpaper /path/to/image.png
# or short form
./aether -w /path/to/image.png
```

4. (Optional) Install desktop entry:
```bash
cp li.oever.aether.desktop ~/.local/share/applications/
```

Or install via AUR:
```bash
yay -S aether
# or
paru -S aether
```

## Usage

### Command Line Options

```bash
./aether [OPTIONS]

Options:
  -h, --help              Show help message
  -w, --wallpaper=FILE    Path to wallpaper image to load on startup
```

Example:
```bash
./aether --wallpaper ~/Pictures/wallpaper.jpg
```

### Basic Workflow

1. **Create a palette:**
   - Upload a wallpaper and extract colors with intelligent ImageMagick algorithm
   - (Optional) Edit wallpaper with filters before extraction
   - Browse wallhaven.cc, local wallpapers, or favorites
   - Choose from 10 color presets
   - Generate color harmonies or gradients

2. **Customize colors:**
   - Adjust individual colors with the color picker
   - Use sliders: vibrance, contrast, brightness, hue, temperature
   - Lock colors to protect them from slider adjustments

3. **Apply theme:**
   - Click "Apply Theme" button
   - Aether processes templates and writes to `~/.config/omarchy/themes/aether/`
   - Runs `omarchy-theme-set aether` to apply across all configured applications

Changes apply instantly via live reload.

### Color Extraction Algorithm

Aether uses an advanced ImageMagick-based extraction system that:

- **Automatically classifies images** as monochrome, low-diversity, or chromatic
- **Adapts palette generation** strategy based on image characteristics
- **Ensures readability** through intelligent brightness normalization
- **Preserves image aesthetics** by prioritizing hue accuracy
- **Caches results** for instant re-extraction (< 0.1s)

## Development

```bash
# Run directly
./aether
# or
gjs -m src/main.js

# Format code
npm run format
```

### Template System

Templates in `templates/` support variable substitution:
- `{background}`, `{foreground}` - Base colors
- `{color0}` through `{color15}` - ANSI colors
- `{color5.strip}` - Color without `#` prefix
- `{color5.rgb}` - Decimal RGB format (e.g., `203,166,247`)

### Blueprint Format

Blueprints are JSON files stored in `~/.config/aether/blueprints/`:
```json
{
  "name": "My Theme",
  "timestamp": 1234567890,
  "palette": {
    "wallpaper": "/path/to/wallpaper.png",
    "lightMode": false,
    "colors": ["#1e1e2e", "#f38ba8", "..."]
  }
}
```

## Troubleshooting

**App won't start:**
```bash
pacman -S gjs gtk4 libadwaita libsoup3
gjs -m src/main.js  # Check for errors
```

**ImageMagick not found:**
```bash
pacman -S imagemagick
magick --version  # Verify installation
```

**Wallhaven not loading:**
- Check internet connection and libsoup3 installation
- Rate limit: 45 requests/minute without API key
- Add API key in settings for higher limits
- Clear cache: `rm -rf ~/.cache/aether/wallhaven-*`

## Contributing

Aether is designed to be extensible. Key areas:
- **Templates**: Add new apps in `templates/` directory
- **Presets**: Add themes to `src/constants/presets.js`
- **UI Components**: Extend components in `src/components/`
- **Color Tools**: Enhance `color-harmony.js` or `color-adjustment-controls.js`
- **Theming**: Add CSS variables in `theme-manager.js`

See `CLAUDE.md` for detailed architecture documentation.

## License

MIT

## Creator
[Bjarne Øverli](https://x.com/iamdothash)
