# Aether widgets for Quickshell

QML widgets that drive Aether from a Hyprland-style desktop bar / launcher. They replace the previously-bundled `aether --widget-*` Wails overlays, which have been removed -- the QML versions live and animate better, and skipping the Wails runtime starts faster.

Two widgets:

- `wallpapers/` -- horizontal carousel of -5deg sheared cards. Flip through `~/Wallpapers`, live-preview a Material-mode palette, hit Enter to apply.
- `blueprints/` -- vertical list of saved blueprints (name + 8-color swatch row). Type to filter, Enter to apply.

Both shell out to the `aether` CLI for everything. No Aether GUI required.

## Requirements

- `quickshell` (`qs`) on PATH
- `aether` on PATH (`make install` puts it in `/usr/bin/`)

## Run

```
qs -p contrib/quickshell/wallpapers/shell.qml
qs -p contrib/quickshell/blueprints/shell.qml
```

Or install each as a named config:

```
ln -s "$PWD/contrib/quickshell/wallpapers" ~/.config/quickshell/aether-wallpapers
ln -s "$PWD/contrib/quickshell/blueprints" ~/.config/quickshell/aether-blueprints
qs -c aether-wallpapers
qs -c aether-blueprints
```

Bind in Hyprland:

```
bind = SUPER, W,     exec, qs -c aether-wallpapers
bind = SUPER, B,     exec, qs -c aether-blueprints
```

## Hyprland blur

Both widgets set their layer namespace (`aether-slider` for wallpapers, `aether-blueprints` for blueprints). Add layerrules to your Hyprland config so the scrim looks like frosted glass instead of flat dark:

```
layerrule = blur, aether-slider
layerrule = ignorezero, aether-slider
layerrule = blur, aether-blueprints
layerrule = ignorezero, aether-blueprints
```

Reload Hyprland (`hyprctl reload`) and re-launch.

## Wallpapers widget

| Key | Action |
| --- | --- |
| left / right | navigate |
| tab / shift+tab | navigate |
| enter | apply current wallpaper as theme |
| ctrl+l | toggle light mode (re-extracts current wallpaper) |
| a..z, 0..9, ... | type-to-search by filename |
| backspace | edit search |
| esc, q | dismiss |

Calls `aether --list-wallpapers --json --with-previews` on startup (pre-generates 800px PNG thumbnails so cards render in one sharp pass), `aether --extract-palette <path> --extract-mode material [--light-mode] --json` on navigation (debounced 200ms), `aether --generate <path> --extract-mode material [--light-mode]` on Enter.

## Blueprints widget

| Key | Action |
| --- | --- |
| up / down | navigate |
| page up / down | navigate by 8 |
| home / end | first / last |
| enter | apply selected blueprint |
| a..z, 0..9, ... | type-to-search by name |
| backspace | edit search |
| esc, q | dismiss |

Calls `aether --list-blueprints --json` on startup, `aether --apply-blueprint <name>` on Enter, then quits.

## Files

```
contrib/quickshell/
├── README.md
├── wallpapers/
│   ├── shell.qml
│   └── WallpaperSlider.qml
└── blueprints/
    ├── shell.qml
    └── Blueprints.qml
```
