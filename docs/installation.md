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

## Debian / Ubuntu

Download the `.deb` package from the [latest release](https://github.com/omacom/aether/releases/latest):

```bash
sudo dpkg -i aether_*.deb
sudo apt-get install -f
```

The `.deb` package includes the `aether` binary and pulls in required runtime dependencies automatically.

## macOS

### Requirements

- **Go** 1.23+
- **Wails CLI** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- **Node.js** 18+
- **Xcode Command Line Tools**: `xcode-select --install`

### Build

```bash
git clone https://github.com/omacom/aether.git
cd aether && make build
```

This builds `aether` as a macOS app in `build/bin/`.

### Install

```bash
make install
```

This copies the app to `/Applications/Aether.app` or the binary to `/usr/local/bin/aether`.

Aether runs in **standalone mode** on macOS — theme files are generated but not applied system-wide. See [Standalone Usage](standalone.md) for integration details.

## Build from Source

### Arch Linux

```bash
sudo pacman -S go webkit2gtk
```

### Debian / Ubuntu

```bash
sudo apt install golang libgtk-3-dev libwebkit2gtk-4.1-dev nodejs npm pkg-config
```

> **Note:** Debian Bookworm and Ubuntu 22.04+ ship only `webkit2gtk-4.1`. The build system handles this automatically via the `-tags webkit2_41` flag, so no manual workaround is needed.

### Build

```bash
git clone https://github.com/omacom/aether.git
cd aether && make build
```

This builds `aether` to `build/bin/`.

## Desktop Entry (Optional)

```bash
cp li.oever.aether.desktop ~/.local/share/applications/
```

## Verify Installation

```bash
./build/bin/aether
```
