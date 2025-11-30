<p align="center">
  <img src="icon.png" alt="Aether Icon" width="256" height="256">
</p>

https://github.com/user-attachments/assets/3d92271f-d874-49a0-ac66-66749e330135

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
- **One-Click Blueprint Imports** - Install themes from websites via `aether://` protocol links (automatic setup on first run)
- **Neovim Themes** - 37 LazyVim-compatible themes with preset matching
- **Shader Manager** - 80+ GLSL screen shaders for hyprshade (color grading, effects, era vibes)
- **Accessibility Checker** - Real-time WCAG contrast ratio validation
- **Customizable UI** - Live theme reload and CSS variable system
- **Multi-App Support** - Hyprland, Waybar, Kitty, Alacritty, btop, Mako, and 15+ more applications
- **Custom Templates** - Override default templates with your own `~/aether-templates/`

## Requirements

- GJS (GNOME JavaScript bindings)
- GTK 4
- Libadwaita 1
- libsoup3 - HTTP client library for wallhaven API
- **ImageMagick** - Intelligent color extraction and image filter processing
- **hyprshade** - Screen shader manager (optional, for shader effects)
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
  -h, --help                    Show help message
  -w, --wallpaper=FILE          Path to wallpaper image to load on startup
  -l, --list-blueprints         List all saved blueprint themes
  -a, --apply-blueprint=NAME    Apply a blueprint by name
  -i, --import-blueprint=URL    Import blueprint from URL or file path
  --auto-apply                  Automatically apply imported blueprint (use with --import-blueprint)
  -g, --generate=FILE           Extract colors from wallpaper and apply theme
  --extract-mode=MODE           Extraction mode: normal (default), monochromatic, analogous, pastel, material
  --light-mode                  Generate light mode theme (for --generate)
  --widget-blueprint            Show floating blueprint selector widget
```

Examples:
```bash
# Launch GUI with wallpaper
./aether --wallpaper ~/Pictures/wallpaper.jpg

# List saved blueprints
./aether -l

# Apply saved blueprint
./aether -a BLUEPRINT_NAME

# Generate and apply theme from wallpaper (CLI only, no GUI)
./aether --generate ~/Pictures/wallpaper.jpg
./aether -g ~/Pictures/wallpaper.jpg

# Generate theme with specific extraction mode
./aether -g wallpaper.jpg --extract-mode=monochromatic
./aether -g wallpaper.jpg --extract-mode=analogous
./aether -g wallpaper.jpg --extract-mode=pastel
./aether -g wallpaper.jpg --extract-mode=material

# Generate light mode theme
./aether -g wallpaper.jpg --light-mode
./aether -g wallpaper.jpg --extract-mode=pastel --light-mode

# Floating widget for quick blueprint switching
./aether --widget-blueprint
```

#### Extraction Modes

When using `--generate`, you can specify an extraction mode to control the color palette style:

- **normal** (default) - Auto-detects image type and applies appropriate strategy (monochrome, low-diversity, or chromatic)
- **monochromatic** - Generates single-hue palette from the dominant color in the image
- **analogous** - Generates harmonious adjacent hues for a cohesive color scheme
- **pastel** - Generates soft, muted palette with reduced saturation
- **material** - Uses actual image colors with Material Design's clean neutral backgrounds and subtle refinement for readability

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

### Custom Templates

You can override the default templates used by Aether to customize how themes are generated for specific applications.

1. Create the templates directory:
   ```bash
   mkdir -p ~/aether-templates
   ```
2. Copy a default template (e.g., `hyprlock.conf`) or create a new one in this directory.
3. Edit the file using Aether variables.

Aether will automatically prioritize files in `~/aether-templates/` over the built-in defaults.

See [TEMPLATE_VARIABLES.md](TEMPLATE_VARIABLES.md) for a complete list of available color variables and format modifiers (e.g., `{background.rgba:0.5}`, `{color5.strip}`).

### Screen Shaders

Aether includes many GLSL screen shaders for hyprshade. Shaders are automatically installed to `~/.config/hypr/shaders/` when you run Aether. Use the Shader Manager in the Settings sidebar to toggle effects, or bind them directly in your Hyprland config.

**Shader Location:** `~/.config/hypr/shaders/`

Add your own `.glsl` files to this directory and they will automatically appear in the Shader Manager list. For GLSL shader tutorials, see [The Book of Shaders](https://thebookofshaders.com/), [Shadertoy](https://www.shadertoy.com/), or [LearnOpenGL - Shaders](https://learnopengl.com/Getting-started/Shaders).

**Manual Binding Example:**
```conf
# In ~/.config/hypr/hyprland.conf
bind = $mainMod, F1, exec, hyprshade toggle grayscale
bind = $mainMod, F2, exec, hyprshade toggle retro-glow
bind = $mainMod, F3, exec, hyprshade off
```

**Shader Categories:**
- Color corrections (grayscale, sepia, duotone, tritone)
- Temperature adjustments (warm-tone, cool-tone, amber, blue-light-reduce)
- Saturation effects (saturate, desaturate, color-pop, pastel)
- Era vibes (40s, 50s, 60s, 70s, 80s, 90s, 00s)
- Artistic looks (golden-hour, cyberpunk-neon, vintage-film, faded-memory)
- Nature themes (forest-green, ocean, arctic-blue, desert-sand, autumn-leaves)
- Accessibility (protanopia, deuteranopia, tritanopia, high-contrast)

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

### Sharing Themes with Protocol Links

Aether supports **one-click theme installation** from websites using the `aether://` protocol. When you first launch Aether, it automatically registers as a handler for `aether://` links.

**How it works:**
1. Export your theme as a blueprint JSON file
2. Host it on GitHub, your website, or a file-sharing service
3. Create a link: `aether://import?url=https://example.com/theme.json`
4. Share the link - users click it and the theme installs automatically!

**Import themes via CLI:**
```bash
# Import from URL
aether --import-blueprint https://example.com/theme.json

# Import and auto-apply
aether --import-blueprint https://example.com/theme.json --auto-apply

# Import local file
aether --import-blueprint /path/to/theme.json
```

See [PROTOCOL_HANDLER.md](PROTOCOL_HANDLER.md) for complete documentation and examples.

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

**Waybar disappears when applying theme from widget mode:**
This is a known issue when running Aether with `LD_PRELOAD=/usr/lib/libgtk4-layer-shell.so` (required for `--widget-blueprint` mode). The layer-shell library gets inherited by child processes, causing conflicts with waybar's own layer-shell usage.

**Solution:** Aether automatically clears `LD_PRELOAD` when spawning `omarchy-theme-set` to prevent this conflict (see `ConfigWriter.js:609`). The fix uses `env -u LD_PRELOAD` to ensure waybar restarts cleanly without inheriting the layer-shell library.

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
