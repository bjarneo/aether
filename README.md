<p align="center">
  <img src="icon.png" alt="Aether Icon" width="256" height="256">
</p>

https://github.com/user-attachments/assets/3d92271f-d874-49a0-ac66-66749e330135

# Aether

A visual theming application for [Omarchy](https://omarchy.org). Extract colors from wallpapers and apply cohesive themes across your entire desktop.

> **Not using Omarchy?** Aether works standalone on any Linux desktop. See the [Standalone Guide](docs/standalone.md) for setup.

## Features

- **Color Extraction** — Intelligent palette generation from any wallpaper
- **Wallpaper Browser** — Search wallhaven.cc or browse local files
- **Image Filters** — Edit wallpapers before extraction (blur, exposure, presets)
- **Color Presets** — Dracula, Nord, Gruvbox, Catppuccin, and more
- **Base16 Import** — Import 250+ community color schemes
- **Blueprints** — Save and share themes as JSON
- **Multi-App Support** — Hyprland, Waybar, Kitty, Neovim, and 15+ more
- **Theme Scheduler** — Auto-switch themes at scheduled times

## Quick Start

### Install (Arch Linux)

```bash
yay -S aether
```

Or install manually:

```bash
sudo pacman -S gjs gtk4 libadwaita libsoup3 imagemagick
git clone https://github.com/bjarneo/aether.git
cd aether && ./aether
```

### Basic Usage

1. Select a wallpaper (drag & drop, file picker, or wallhaven browser)
2. Click **Extract** to generate a color palette
3. Adjust colors as needed
4. Click **Apply Theme**

That's it! Your theme is now applied across all configured applications.

## CLI

```bash
# Generate theme from wallpaper (no GUI)
aether -g ~/wallpaper.jpg

# Apply saved blueprint
aether -a "My Theme"

# List blueprints
aether -l

# Open with wallpaper
aether -w ~/wallpaper.jpg
```

See `aether --help` for all options.

## Documentation

| Guide | Description |
|-------|-------------|
| [Installation](docs/installation.md) | Detailed setup instructions |
| [Color Extraction](docs/color-extraction.md) | How the algorithm works |
| [Base16 Schemes](docs/base16.md) | Import community color schemes |
| [Wallpaper Editor](docs/wallpaper-editor.md) | Image filters & presets |
| [Wallhaven](docs/wallhaven.md) | Browse online wallpapers |
| [Blueprints](docs/blueprints.md) | Save & restore themes |
| [Custom Templates](docs/custom-templates.md) | Add support for your apps |
| [Scheduler](docs/scheduler.md) | Automatic theme switching |
| [Sharing](docs/sharing.md) | Community sharing & protocol links |
| [CLI Reference](docs/cli.md) | Command-line options |
| [File System](docs/filesystem.md) | Where Aether stores files |
| [Standalone](docs/standalone.md) | Using Aether without Omarchy |
| [Troubleshooting](docs/troubleshooting.md) | Common issues |

## Complementary Projects

- [omarchy-theme-hook](https://github.com/imbypass/omarchy-theme-hook/) — A clean solution to extend your Omarchy theme to other apps.

## Contributing

- **Templates**: Add apps in `templates/`
- **Presets**: Add themes to `src/constants/presets.js`
- **Components**: Extend `src/components/`

See [CLAUDE.md](CLAUDE.md) for architecture details.

## License

MIT — Created by [Bjarne Øverli](https://x.com/iamdothash)
