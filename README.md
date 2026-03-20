<p align="center">
  <img src="icon.png" alt="Aether Icon" width="256" height="256">
</p>


https://github.com/user-attachments/assets/862377df-ad05-48de-a0a3-65b243c4b44b


# Aether

A visual theming application for [Omarchy](https://omarchy.org). Extract colors from wallpapers and apply cohesive themes across your entire desktop.

> **Not using Omarchy?** Aether works standalone on any Linux desktop. See the [Standalone Guide](docs/standalone.md) for setup.

## Features

### Color Extraction
- Pure Go median-cut algorithm that generates a full 16-color ANSI palette from any wallpaper
- 8 extraction modes: Normal, Monochromatic, Analogous, Pastel, Material, Colorful, Muted, and Bright
- 12 fine-tuning sliders (vibrance, contrast, temperature, shadows, highlights, and more)
- Light and dark mode toggle with automatic color anchor swapping
- Batch processing for up to 10 wallpapers at once

### Wallpaper Tools
- Search and download wallpapers from wallhaven.cc directly in the app
- Full wallpaper editor with blur, exposure, sharpen, vignette, grain, and color toning
- 12 one-click image presets: Cinematic, Vintage, Film, Dramatic, and more
- Drag-and-drop, file picker, and local directory scanning

### Theme Library
- 24 built-in color presets including Dracula, Nord, Gruvbox, Catppuccin, and Sakura
- Import 250+ community Base16 color schemes
- Save and restore complete themes as blueprint files
- Export themes as shareable packages with selective app inclusion

### Application Support
- 20+ pre-configured apps: Hyprland, Waybar, Kitty, Alacritty, Ghostty, Neovim, VS Code, Zed, btop, and more
- Template system with hex, RGB, RGBA, and stripped format modifiers
- Per-app overrides, reload hooks, and post-apply scripts
- Add your own apps with custom templates

### Extras
- WCAG contrast ratio checker with AAA/AA accessibility grading
- Gradient generator and single-color palette builder
- 50-step undo/redo history
- Headless CLI for scripting, keybinds, and automation

## Quick Start

### Install (Arch Linux)

```bash
yay -S aether
```

Or build from source:

```bash
sudo pacman -S go webkit2gtk
git clone https://github.com/bjarneo/aether.git
cd aether && make build
```

### Basic Usage

1. Select a wallpaper (drag & drop, file picker, or wallhaven browser)
2. Click **Extract** to generate a color palette
3. Adjust colors as needed
4. Click **Apply Theme**

## CLI

```bash
aether --generate ~/wallpaper.jpg
aether --apply-blueprint "My Theme"
aether --list-blueprints
```

See `aether --help` for all options.

## Local Development

```bash
git clone https://github.com/bjarneo/aether.git
cd aether

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run in development mode (hot reload)
wails dev

# Build production binary
wails build
```

**Prerequisites:** Go 1.23+, Node.js 18+, [Wails v2](https://wails.io), webkit2gtk

## Documentation

| Guide | Description |
|-------|-------------|
| [Installation](docs/installation.md) | Detailed setup instructions |
| [CLI Reference](docs/cli.md) | Command-line options |
| [Color Extraction](docs/color-extraction.md) | How the algorithm works |
| [Base16 Schemes](docs/base16.md) | Import community color schemes |
| [Wallpaper Editor](docs/wallpaper-editor.md) | Image filters and presets |
| [Wallhaven](docs/wallhaven.md) | Browse online wallpapers |
| [Blueprints](docs/blueprints.md) | Save and restore themes |
| [Custom Templates](docs/custom-templates.md) | Add support for your apps |
| [Custom Apps](docs/custom-apps.md) | Per-app template system |
| [File System](docs/filesystem.md) | Where Aether stores files |
| [Standalone](docs/standalone.md) | Using Aether without Omarchy |
| [Troubleshooting](docs/troubleshooting.md) | Common issues |

## Complementary Projects

- [omarchy-theme-hook](https://github.com/imbypass/omarchy-theme-hook/) - A clean solution to extend your Omarchy theme to other apps.

## Contributing

See [CLAUDE.md](CLAUDE.md) for architecture details.

## License

MIT - Created by [Bjarne Overli](https://x.com/iamdothash)
