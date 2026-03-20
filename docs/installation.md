# Installation

## Requirements

- **Go** 1.23+
- **webkit2gtk** (GUI runtime)
- **Node.js** 18+ (build only)

## Arch Linux (AUR)

```bash
yay -S aether
# or
paru -S aether
```

## Build from Source

```bash
sudo pacman -S go webkit2gtk

git clone https://github.com/bjarneo/aether.git
cd aether && make build
```

The binary is output to `build/bin/aether`.

## Desktop Entry (Optional)

```bash
cp li.oever.aether.desktop ~/.local/share/applications/
```

## Verify Installation

```bash
./build/bin/aether
```
