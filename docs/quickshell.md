# Quickshell widgets

QML widgets that drive Aether from a Hyprland-style bar / launcher. They run as Wayland layer-shell overlays and shell out to the `aether` CLI for everything, so no Aether GUI is required.

Two widgets ship in `contrib/quickshell/`:

- **Wallpapers**: horizontal carousel of -5deg sheared parallelogram cards. Browse `~/Wallpapers`, live-preview a Material-mode palette, hit Enter to apply.
- **Blueprints**: vertical list of saved blueprints (name + 8-color swatch). Type to filter, Enter to apply.

These replace the previous Wails-based `--widget-blueprint`, `--widget-wallpaper-slider`, and `--widget-themes-slider` modes, which have been removed.

## Requirements

- `quickshell` (`qs`) on PATH
- `aether` on PATH (`make install` puts it in `/usr/bin/`)
- A Wayland compositor with layer-shell support (Hyprland, Sway, KWin, river, ...)

## Run

```sh
qs -p contrib/quickshell/wallpapers/shell.qml
qs -p contrib/quickshell/blueprints/shell.qml
```

Or install each as a named config so `qs -c <name>` works:

```sh
ln -s "$PWD/contrib/quickshell/wallpapers" ~/.config/quickshell/aether-wallpapers
ln -s "$PWD/contrib/quickshell/blueprints" ~/.config/quickshell/aether-blueprints

qs -c aether-wallpapers
qs -c aether-blueprints
```

## Hyprland keybinds

```
bind = SUPER, W, exec, qs -c aether-wallpapers
bind = SUPER, B, exec, qs -c aether-blueprints
```

## Hyprland blur

Both widgets set a Wayland layer namespace so Hyprland can target them with a layerrule. Without the layerrule, the dark scrim is a flat tint; with it, the wallpaper underneath is compositor-blurred and you see a real frosted-glass effect.

Add to `~/.config/hypr/hyprland.conf`:

```
layerrule = blur, aether-slider
layerrule = ignorezero, aether-slider
layerrule = blur, aether-blueprints
layerrule = ignorezero, aether-blueprints
```

Then `hyprctl reload` and re-launch.

For non-Hyprland compositors (KWin, etc.) you'd need to wire up their equivalent blur mechanism, or edit `shell.qml` to add a `BackgroundEffect.blurRegion: Region { ... }` block, which uses the `ext-background-effect-v1` Wayland protocol where supported.

## Wallpapers widget

Fullscreen overlay, horizontal carousel. Cards farther from the active one shrink in width, height, and opacity to put the focus on the hero.

| Key | Action |
| --- | --- |
| left / right | navigate |
| tab / shift+tab | navigate |
| enter | apply current wallpaper as theme |
| ctrl+l | toggle light mode (re-extracts current wallpaper) |
| a..z, 0..9, ... | type-to-search by filename |
| backspace | edit search |
| esc, q | dismiss |

### CLI calls

- `aether --list-wallpapers --json --with-previews` on startup. Generates 800px PNG thumbnails at `~/.cache/aether/thumbnails/` so cards render in one sharp pass instead of a blurry-then-sharp swap. First run for a new wallpaper folder takes a moment (parallel generation, 8 workers); subsequent runs are instant `stat()`s.
- `aether --extract-palette <path> --extract-mode material [--light-mode] --json` on navigation (debounced 200ms). Cached in-process by path so revisiting a wallpaper is free.
- `aether --generate <path> --extract-mode material [--light-mode]` on Enter.

### Light mode

Ctrl+L toggles `lightMode`. The widget keeps its own chrome dark either way (so the blurred scrim stays readable), but the inline palette strip on the active card and the accent border use the real light-mode colors from `aether --extract-palette --light-mode`, so you see what you're about to apply.

## Blueprints widget

Centered card, vertical list. Each row shows the blueprint name plus the first 8 colors of its palette.

| Key | Action |
| --- | --- |
| up / down | navigate |
| page up / down | jump 8 rows |
| home / end | first / last |
| enter | apply selected blueprint |
| a..z, 0..9, ... | type-to-search by name |
| backspace | edit search |
| esc, q | dismiss |

### CLI calls

- `aether --list-blueprints --json` on startup.
- `aether --apply-blueprint <name>` on Enter, then the widget self-dismisses.

## Folder layout

```
contrib/quickshell/
|-- README.md
|-- wallpapers/
|   |-- shell.qml
|   `-- WallpaperSlider.qml
`-- blueprints/
    |-- shell.qml
    `-- Blueprints.qml
```

Each `shell.qml` is the entry point that sets up the layer-shell overlay; the sibling `.qml` file holds the actual carousel / list logic, processes, and key handling.

## Customizing

Both widgets are plain QML. Common tweaks:

- **Card sizes** -- top of `WallpaperSlider.qml`, properties `cardW`, `cardActiveW`, `cardH`, `cardActiveH`, `cardMinW`, `cardMinH`.
- **Skew angle** -- `skew` property on the root of `WallpaperSlider.qml`. Default `5` deg. Set to `0` to disable.
- **Scrim opacity** -- the `Rectangle { anchors.fill: parent; color: Qt.rgba(... , 0.40) }` block near the top of each widget's visual tree. Higher alpha = more opaque chrome, less wallpaper blur showing through.
- **Blueprint card opacity** -- `card` Rectangle in `Blueprints.qml`, `color: Qt.rgba(0.06, 0.06, 0.07, 0.92)`.

## Troubleshooting

**"list parse: SyntaxError: JSON.parse: Parse error"**

The system `aether` binary is older than the source tree. `--with-previews` (wallpapers) and `--json` on `--list-blueprints` were added recently. Reinstall:

```sh
sudo cp build/bin/aether /usr/bin/aether
```

**Wallpaper images show as "broken"**

The file on disk is 0 bytes or in a format `qt6-base` doesn't decode (rare). The widget filters out 0-byte files automatically; if you see "broken" placeholders, those are non-empty files that failed decoding.

**Scrim is fully opaque, no blur visible**

Hyprland layerrule isn't loaded. Re-check `~/.config/hypr/hyprland.conf` has the `layerrule = blur, aether-slider` / `aether-blueprints` lines and run `hyprctl reload`. The warning about `ext-background-effect-v1` in the log is unrelated and harmless.
