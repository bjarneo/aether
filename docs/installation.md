# Installation

## Requirements

- **Go** 1.23+
- **webkit2gtk** (GUI runtime)
- **gtk-layer-shell** (animated wallpaper layer)
- **gstreamer**, **gst-plugins-good** (video playback for animated wallpapers)
- **ffmpeg** (video thumbnail and color extraction)
- **Node.js** 18+ (build only)

## Arch Linux (AUR)

```bash
yay -S aether
# or
paru -S aether
```

## Debian / Ubuntu

Download the `.deb` package from the [latest release](https://github.com/bjarneo/aether/releases/latest):

```bash
sudo dpkg -i aether_*.deb
sudo apt-get install -f
```

The `.deb` package includes both `aether` and `aether-wp` binaries and pulls in all required dependencies automatically.

## Build from Source

### Arch Linux

```bash
sudo pacman -S go webkit2gtk gtk-layer-shell gstreamer gst-plugins-good ffmpeg
```

### Debian / Ubuntu

```bash
sudo apt install golang libgtk-3-dev libwebkit2gtk-4.1-dev libgtk-layer-shell-dev \
  libgstreamer1.0-dev gstreamer1.0-plugins-good ffmpeg nodejs npm pkg-config
```

### Build

```bash
git clone https://github.com/bjarneo/aether.git
cd aether && make build
```

This builds two binaries to `build/bin/`:
- `aether` — the main application
- `aether-wp` — animated wallpaper service (.gif, .mp4, .webm)

## Desktop Entry (Optional)

```bash
cp li.oever.aether.desktop ~/.local/share/applications/
```

## Verify Installation

```bash
./build/bin/aether
```
