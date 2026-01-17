# Installation

## Requirements

- GJS (GNOME JavaScript bindings)
- GTK 4 + Libadwaita 1
- libsoup3 (HTTP client)
- ImageMagick (color extraction)

## Arch Linux (AUR)

```bash
yay -S aether
# or
paru -S aether
```

## Manual Installation

```bash
# Install dependencies
sudo pacman -S gjs gtk4 libadwaita libsoup3 imagemagick

# Clone and run
git clone https://github.com/bjarneo/aether.git
cd aether
./aether
```

## Desktop Entry (Optional)

```bash
cp li.oever.aether.desktop ~/.local/share/applications/
```

## Verify Installation

```bash
# Check ImageMagick
magick --version

# Run Aether
./aether
# or
gjs -m src/main.js
```
