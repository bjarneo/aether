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

## Build from Source

```bash
sudo pacman -S go webkit2gtk gtk-layer-shell gstreamer gst-plugins-good ffmpeg

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
