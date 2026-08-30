# Omarchy shell plugins

Open Aether's wallpaper and blueprint selectors inside the native Omarchy shell. The plugins use Omarchy colors, lifecycle, keyboard focus, and plugin registry while the `aether` CLI supplies palettes and themes.

## Install

Package installs include a helper:

```bash
aether-install-omarchy-plugins
```

For a source checkout:

```bash
make install-omarchy-plugins
```

The installer validates both manifests, writes them to `~/.config/omarchy/plugins/`, and enables them when `omarchy-shell` is running. It refuses to replace a plugin directory that is not marked as Aether-managed.

## Open

```bash
omarchy-shell shell toggle aether.wallpapers '{}'
omarchy-shell shell toggle aether.blueprints '{}'
```

Example Hyprland keybinds:

```conf
bind = SUPER, W, exec, omarchy-shell shell toggle aether.wallpapers '{}'
bind = SUPER, B, exec, omarchy-shell shell toggle aether.blueprints '{}'
```

## Wallpaper Selector

Browse local wallpapers, preview a Material palette, and generate an Aether theme from the selected image.

| Key | Action |
| --- | --- |
| left / right | Navigate |
| tab / shift+tab | Navigate |
| enter | Apply the selected wallpaper and theme |
| ctrl+l | Toggle light extraction mode |
| type | Filter by filename |
| backspace | Edit the filter |
| esc, q | Close |

The plugin calls:

```text
aether --list-wallpapers --json --with-previews
aether --extract-palette <path> --extract-mode material [--light-mode] --json
aether --generate <path> --extract-mode material [--light-mode]
```

## Blueprint Selector

Browse saved Aether blueprints and apply one without opening the editor.

| Key | Action |
| --- | --- |
| up / down | Navigate |
| page up / page down | Jump eight rows |
| home / end | First / last |
| enter | Apply the selected blueprint |
| type | Filter by name |
| backspace | Edit the filter |
| esc, q | Close |

The plugin calls `aether --list-blueprints --json` and `aether --apply-blueprint <name>`.

## Plugin Files

```text
~/.config/omarchy/plugins/
|-- aether.wallpapers/
|   |-- manifest.json
|   |-- shell.qml
|   `-- WallpaperSlider.qml
`-- aether.blueprints/
    |-- manifest.json
    |-- shell.qml
    `-- Blueprints.qml
```

Omarchy watches this directory. To force a refresh:

```bash
omarchy-shell shell rescanPlugins
omarchy plugin enable aether.wallpapers
omarchy plugin enable aether.blueprints
```

## Troubleshooting

Check discovery and state:

```bash
omarchy plugin list
omarchy plugin validate ~/.config/omarchy/plugins/aether.wallpapers
omarchy plugin validate ~/.config/omarchy/plugins/aether.blueprints
```

If a selector opens but reports that an Aether command failed, verify that `aether` on `PATH` is the current build with `aether --version`.
