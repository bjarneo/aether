<p align="center">
  <img src="icon.png" alt="Aether Icon" width="256" height="256">
</p>

https://github.com/user-attachments/assets/1cf4c084-355a-42c3-b754-fb9f2a417013


# Aether

Aether is a beautiful GTK/Libadwaita theming application for Omarchy. It provides real-time, visual control over your desktop aesthetic through pywal integration and template-based theme generation. Instead of editing text files, you sculpt your desktop's look and feel with interactive controls and see changes happen live.

## Features

### 🎨 Triple Palette Generation Modes

#### From Wallpaper (Automatic Extraction)
- Drag-and-drop wallpaper or use file picker
- Automatic extraction of 16 ANSI colors using pywal
- Light/Dark mode toggle for generating light or dark color schemes
- Intelligent color analysis optimized for terminals and desktop themes
- Real-time wallpaper preview

#### Custom Palette
- Start with beautiful predefined color scheme
- Upload wallpaper for visual reference (optional)
- Manually craft your perfect palette
- Click any color swatch to fine-tune individual colors with advanced color picker

#### Find Wallpaper (Wallhaven Integration)
- Browse thousands of wallpapers from [wallhaven.cc](https://wallhaven.cc)
- Advanced search by tags, colors, and keywords
- Filter by categories (General, Anime, People)
- Sort options: Latest, Relevance, Random, Views, Favorites, Top List
- Thumbnail grid view with pagination
- One-click download and automatic color extraction
- Smart caching system for thumbnails and wallpapers
- Optional API key support for additional content and higher rate limits
- Settings dialog for easy API key configuration

### 🎨 Color Presets Library
10 popular hand-picked themes ready to use:
- **Dracula** - Dark theme with vibrant colors
- **Nord** - Arctic, north-bluish color palette
- **Gruvbox Dark** - Retro groove with warm tones
- **Solarized Dark** - Precision colors for machines and people
- **Tokyo Night** - Clean, dark theme inspired by Tokyo's night
- **Catppuccin Mocha** - Soothing pastel theme
- **One Dark** - Atom's iconic One Dark theme
- **Monokai Pro** - Sublime's classic colorful theme
- **Palenight** - Elegant Material theme variant
- **Rose Pine** - All natural pine, faux fur and a bit of soho vibes

### 💻 Neovim Theme Integration
37 LazyVim-compatible Neovim themes with perfect color preset matching:
- **One-click selection** - Choose your Neovim theme from the Settings sidebar
- **Visual feedback** - Checkmark indicator shows selected theme
- **Blueprint integration** - Themes saved and restored with blueprints
- **100% coverage** - Every color preset has a matching Neovim theme
- **Light & dark variants** - All theme variations included
- **LazyVim format** - Ready-to-use plugin configurations
- **Deferred writing** - Theme applied only when you click "Apply Theme"

Select a color preset like "Gruvbox Dark" for your desktop, then choose the matching "Gruvbox" Neovim theme for perfect visual consistency across your entire workspace!

**Available themes include**: Catppuccin (Mocha & Latte), Tokyo Night, Gruvbox (Dark & Light), Rose Pine (Main & Dawn), Nord, Dracula, One Dark, Kanagawa, Nightfox, Everforest, Solarized (Dark & Light), GitHub (Dark & Light), and many more.

### 🌈 Gradient Generator
- Create smooth color transitions between two colors
- Real-time gradient preview with 16 color steps
- Linear RGB interpolation for natural-looking gradients
- Perfect for creating cohesive color schemes
- Live preview updates as you adjust start/end colors

### 🎛️ Advanced Color Adjustments
Fine-tune your entire palette with real-time sliders:
- **Vibrance** - Boost or reduce color intensity
- **Contrast** - Adjust difference between light and dark
- **Brightness** - Overall lightness/darkness
- **Hue Shift** - Rotate colors on the color wheel
- **Temperature** - Make colors warmer (red) or cooler (blue)
- **Gamma** - Adjust mid-tone brightness
- Debounced updates prevent UI freezing
- One-click reset to original palette

### 🎯 Color Role Management
- Edit all 16 ANSI terminal colors (color0-15)
- Customize background and foreground colors
- Visual color picker for each role
- Real-time preview across the interface
- Colors sync across all applications via omarchy templates

### 🔒 Color Lock System
- Lock individual colors to protect them from changes
- Locked colors exempt from adjustment sliders
- Visual indicators: accent border shows locked state
- Hover-to-reveal lock button on each swatch
- Click lock icon to toggle protection
- Perfect for preserving specific colors while experimenting
- Lock state resets when loading blueprints (not saved to blueprints)

### ♿ WCAG Accessibility Checker
- Real-time contrast ratio calculations
- AA and AAA compliance indicators
- Foreground vs Background contrast testing
- Ensures your themes are readable and accessible

### 📦 Blueprint System
- Save themes as shareable JSON blueprints
- Quick theme switching with one click
- Modal dialog for easy browsing and management
- Import/Export blueprints for sharing with others
- Blueprints preserve wallpaper paths, palette colors, and light/dark mode
- Auto-assigns color roles when loading blueprints
- Stored in `~/.config/aether/blueprints/`

### 🎨 Lightroom-Style Interface
- Collapsible right sidebar with all settings
- Clean, focused main workspace
- Organized sections:
  - Color Adjustments
  - Color Harmony Generator
  - Gradient Generator
  - Preset Library
  - Neovim Themes (37 LazyVim configurations)
  - Template Settings (Neovim, Vencord)
  - Accessibility Checker
- Toggle sidebar visibility with one click

### 🎨 Customizable UI Theming
- Comprehensive CSS variable system for UI customization
- 19 theme variables covering buttons, backgrounds, sliders, and accent colors
- Live theme reload without restart
- User-editable override file: `~/.config/aether/theme.override.css`
- 20 pre-made theme examples (Gruvbox, Tokyo Night, Dracula, Nord, and more)
- Sharp corners throughout for Hyprland aesthetic
- Unified accent color system (no hardcoded blues)
- Complete theming documentation in `THEMING.md`

### 🔄 Omarchy Integration
- Template-based theme generation
- One-click apply updates all applications instantly
- Export themes with custom names and directories
- Non-destructive (doesn't modify your personal configs)
- Supports 15+ applications: Hyprland, Waybar, Kitty, Wofi, Walker, Alacritty, Ghostty, btop, Mako, SwayOSD, Hyprlock, and more
- Optional template inclusion:
  - **Neovim** - Lua theme file for Neovim editors
  - **Vencord** - Discord client theme (vencord.theme.css)

### ⚡ Quality of Life Features
- **Reset Button** - Instantly return to launch state
- **Drag-and-Drop** - Drop wallpapers directly onto the interface
- **Tab Navigation** - Switch between wallpaper and custom modes
- **Color Locking** - Protect specific colors while experimenting
- **Live Previews** - See colors before applying
- **Persistent Settings** - Your preferences are remembered
- **Blueprint Sharing** - Import/Export themes as JSON files

## Requirements

- GJS (GNOME JavaScript bindings)
- GTK 4
- Libadwaita 1
- libsoup3 - HTTP client library for wallhaven API
- **pywal** - Color extraction from wallpapers
- **Omarchy** - Theme application backend

## Installation

1. Install system dependencies:
```bash
sudo pacman -S gjs gtk4 libadwaita libsoup3 python-pywal
# Install omarchy theme manager from AUR or your preferred method
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

### Theming Aether's Interface

When you apply a theme in Aether, it automatically updates the application's own interface to match your chosen colors:

**Auto-theming:**
1. Apply any theme using the "Apply Theme" button
2. Aether generates `aether.override.css` in `~/.config/omarchy/themes/aether/`
3. A symlink is created at `~/.config/aether/theme.override.css`
4. The interface instantly updates with your theme colors (live reload)

The generated file is a standard GTK CSS theme using `@define-color` variables, fully compatible with GTK/Libadwaita.

### Customizing Aether's UI

Aether includes a powerful theming system to customize the application's own appearance (not to be confused with desktop theme generation). See `THEMING.md` for complete documentation, or:

**Quick start:**
1. Copy an example theme: `cp examples/gruvbox-theme.override.css ~/.config/aether/theme.override.css`
2. Changes apply instantly - no restart needed
3. Edit `~/.config/aether/theme.override.css` to create your own theme

20 pre-made themes available in `examples/` directory.

### Theme Files

Aether uses a template-based system:

- Templates: `Aether/templates/*.conf` or `*.css`
- Output: `~/.config/omarchy/themes/aether/`
- Wallpaper: Copied to `~/.config/omarchy/themes/aether/backgrounds/`
- Your personal configs remain untouched

**Optional Templates:**
- **neovim.lua** - Neovim color scheme (enabled by default)
- **vencord.theme.css** - Discord client theme via Vencord (disabled by default)

Toggle these in Template Settings sidebar to include/exclude them when applying themes.

## Project Structure

```
Aether/
├── src/
│   ├── main.js                          # Main application window
│   ├── components/
│   │   ├── PaletteGenerator.js          # Triple-mode palette generation (wallpaper/custom/browser)
│   │   ├── WallpaperBrowser.js          # Wallhaven.cc browser with search/filters
│   │   ├── ColorSynthesizer.js          # Color role editor (background, foreground, color0-15)
│   │   ├── BlueprintManager.js          # Theme save/load/apply
│   │   ├── SettingsSidebar.js           # Collapsible settings sidebar
│   │   ├── AccessibilityPanel.js        # WCAG contrast checker
│   │   └── palette/
│   │       ├── color-swatch-grid.js     # 16-color grid with lock feature
│   │       ├── color-picker-dialog.js   # Advanced color picker
│   │       └── color-adjustment-controls.js # Vibrance, contrast, etc.
│   ├── services/
│   │   ├── wallpaper-service.js         # Pywal integration
│   │   ├── wallhaven-service.js         # Wallhaven.cc API client
│   │   ├── color-harmony.js             # Color theory algorithms
│   │   └── theme-manager.js             # CSS theming system with live reload
│   ├── constants/
│   │   ├── colors.js                    # Color roles and defaults
│   │   ├── presets.js                   # 29 popular color presets
│   │   └── neovim-presets.js            # 37 LazyVim Neovim themes
│   └── utils/
│       ├── ConfigWriter.js              # Template processor & omarchy integration
│       ├── color-utils.js               # HSL/RGB/Hex conversions
│       ├── accessibility-utils.js       # WCAG contrast calculations
│       ├── ui-helpers.js                # GTK helper functions
│       └── file-utils.js                # File I/O wrappers
├── templates/                           # Config templates with {variable} placeholders
│   ├── alacritty.toml
│   ├── btop.theme
│   ├── chromium.theme
│   ├── ghostty.conf
│   ├── hyprland.conf
│   ├── hyprlock.conf
│   ├── icons.theme
│   ├── kitty.conf
│   ├── mako.ini
│   ├── neovim.lua                       # Optional Neovim theme
│   ├── swayosd.css
│   ├── vencord.theme.css                # Optional Discord/Vencord theme
│   ├── walker.css
│   ├── waybar.css
│   └── wofi.css
├── examples/                            # 20 pre-made UI theme examples
├── icon.png
├── aether                               # Launcher script
├── li.oever.aether.desktop              # Desktop entry file
├── THEMING.md                           # Complete theming documentation
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

### Code Formatting

Aether uses Prettier for consistent code formatting:

```bash
# Format all JavaScript files
npm run format

# Check formatting without making changes
npm run format:check
```

**Configuration** (`.prettierrc`):
- 4 spaces for indentation
- Single quotes
- Semicolons enabled
- ES5 trailing commas
- No bracket spacing
- Arrow functions without parentheses when possible

For automatic formatting on save:
- **VSCode**: Install the Prettier extension
- **Other editors**: Configure to run `prettier --write` on save

## Architecture

### Theme Application Flow

#### From Wallpaper Mode
1. User selects wallpaper via file picker or drag-and-drop
2. Optionally toggle Light Mode for light color schemes
3. Aether runs `wal -n -s -t -e -i <image>` to generate colors
4. Reads 16 colors from `~/.cache/wal/colors`
5. User optionally customizes colors with:
   - Direct swatch editing (with color lock protection)
   - Color adjustment sliders (vibrance, contrast, etc.)
6. Click "Apply Theme" to deploy

#### Find Wallpaper Mode
1. Browse wallpapers from wallhaven.cc
2. Search by tags, colors, or keywords
3. Filter by categories (General, Anime, People)
4. Sort by Latest, Relevance, Random, Views, Favorites, or Top List
5. Click a wallpaper thumbnail to download
6. Automatically switches to "From Wallpaper" tab and extracts colors
7. Continue with customization as in From Wallpaper mode

#### Custom Palette Mode
1. Starts with predefined Catppuccin-inspired palette
2. User optionally uploads wallpaper for visual reference
3. User customizes palette via:
   - Preset selection (Dracula, Nord, Gruvbox, etc.)
   - Color Harmony generator (complementary, triadic, etc.)
   - Gradient generator (smooth color transitions)
   - Direct swatch editing
   - Color adjustment sliders (with color lock protection)
4. Click "Apply Theme" to deploy

#### Apply Process (Both Modes)
- Create `~/.config/omarchy/themes/aether/` directory
- Copy wallpaper to theme's `backgrounds/` folder (if provided)
- Process all templates in `templates/` directory
- Replace `{variable}` placeholders with actual colors
- Write processed configs to theme directory
- Run `omarchy-theme-set aether` to apply across all applications

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
    "lightMode": false,
    "colors": [
      "#1e1e2e",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#cba6f7",
      "#94e2d5",
      "#cdd6f4",
      "#45475a",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#cba6f7",
      "#94e2d5",
      "#ffffff"
    ]
  }
}
```

Color roles (background, foreground, color0-15) are automatically assigned from the palette when loading.

## Troubleshooting

**App won't start:**
- Ensure GJS is installed: `pacman -S gjs gtk4 libadwaita libsoup3`
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

**Wallhaven wallpapers not loading:**
- Check internet connection
- Verify libsoup3 is installed: `pacman -S libsoup3`
- Check API rate limits (45 requests/minute without API key)
- Add API key in settings for higher limits and additional content access
- Clear cache if needed: `rm -rf ~/.cache/aether/wallhaven-*`

## Contributing

Aether is designed to be extensible:

1. **Add New Apps**: Create new template files in `templates/` directory
2. **Add Color Presets**: Add themes to `src/constants/presets.js` (16-color arrays)
3. **Modify Color Mappings**: Edit `ColorSynthesizer.js` roles array
4. **Enhance UI**: Add new widgets to `main.js` or component files
5. **Template Variables**: Add new variable processing in `ConfigWriter.js`
6. **Color Algorithms**: Add harmony types in `src/services/color-harmony.js`
7. **Adjustment Controls**: Extend color adjustments in `color-adjustment-controls.js`
8. **Gradient Algorithms**: Enhance gradient generation in `SettingsSidebar.js`
9. **Blueprint Features**: Extend import/export in `BlueprintManager.js`
10. **UI Theming**: Add new CSS variables in `theme-manager.js` for customizable UI elements

## Philosophy

> From Configuration to Creation

Aether is the visual theming interface for Omarchy. It bridges the gap between automated color extraction and manual config editing, providing an intuitive, Lightroom-inspired interface to craft beautiful desktop themes.

Whether you want to:
- Browse and download wallpapers from wallhaven.cc
- Extract colors from your favorite wallpaper
- Generate palettes using color theory (harmonies)
- Create smooth gradients between two colors
- Pick from popular presets like Dracula or Nord
- Start from scratch with a custom palette

Aether gives you professional-grade tools with a friendly interface. The focus shifts from editing multiple config files to creative exploration: "Pick a source, refine the colors, lock your favorites, click apply."

Every interaction is immediate, visual, and reversible. Real-time previews, accessibility checking, and one-click resets make theme creation both powerful and approachable.

## License

MIT

## Creator
[Bjarne Øverli](https://x.com/iamdothash)
