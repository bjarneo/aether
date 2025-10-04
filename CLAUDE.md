# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aether is a GTK/Libadwaita theming application for Omarchy. It provides a visual interface for creating and applying desktop themes through pywal color extraction and template-based configuration generation.

**Core workflow:**
1. User selects wallpaper → pywal extracts 16 ANSI colors
2. Colors auto-assign to UI roles (background, foreground, color0-15)
3. User customizes colors/settings in GUI
4. "Apply Theme" processes templates → writes to `~/.config/omarchy/themes/aether/` → runs `omarchy-theme-set aether`

## Running the Application

```bash
# Development (from project root)
./aether
# or
gjs -m src/main.js

# Alternative methods
npm start
npm run dev
```

## Architecture

### Entry Point & Window Management
- **src/main.js**: Main entry point with `AetherApplication` and `AetherWindow`
  - Uses Adw.NavigationSplitView for sidebar/content layout
  - Sidebar: BlueprintManager (saved themes)
  - Content: PaletteGenerator + ColorSynthesizer + ActionBar

### Core Components

**PaletteGenerator** (`src/components/PaletteGenerator.js`)
- Wallpaper selection via file dialog or drag-and-drop
- Calls `extractColorsFromWallpaper()` which runs `wal -n -s -t -e -i <image>`
- Displays 16-color swatch grid with click-to-edit
- Color adjustment controls (vibrance, contrast, brightness, hue shift, temperature, gamma)
- Emits: `palette-generated` signal with 16 colors

**ColorSynthesizer** (`src/components/ColorSynthesizer.js`)
- Displays color role assignments (background, foreground, color0-15) using Adw.ActionRow
- Auto-assigns palette colors to roles: background=color0, foreground=color15, etc.
- Each role has a Gtk.ColorDialogButton for manual adjustment
- Emits: `color-changed` signal on role modifications

**BlueprintManager** (`src/components/BlueprintManager.js`)
- Saves/loads theme blueprints as JSON in `~/.config/aether/blueprints/`
- Blueprint format: `{ name, timestamp, palette: { wallpaper, colors }, colors: { role: hex } }`
- Emits: `blueprint-applied` signal

**ConfigWriter** (`src/utils/ConfigWriter.js`)
- Processes templates from `templates/` directory
- Replaces variables: `{background}`, `{color0}`, `{color5.strip}` (no #), `{color5.rgb}` (decimal RGB)
- Writes processed configs to `~/.config/omarchy/themes/aether/`
- Copies wallpaper to `~/.config/omarchy/themes/aether/backgrounds/`
- Executes `omarchy-theme-set aether` via `GLib.spawn_command_line_async()`

### Services

**wallpaper-service.js**: Executes pywal via `Gio.Subprocess`, reads colors from `~/.cache/wal/colors`, brightens colors 9-15 for better terminal contrast

**color-harmony.js**: Generates color harmonies (complementary, triadic, etc.) - currently unused in UI

### Template System

Templates live in `templates/` directory (hyprland.conf, kitty.conf, waybar.css, etc.)

**Variable formats:**
- `{background}`, `{foreground}`, `{color0}` through `{color15}`: Direct hex color
- `{color5.strip}`: Removes `#` prefix (e.g., `#ff00ff` → `ff00ff`)
- `{color5.rgb}`: Decimal RGB format (e.g., `#ff00ff` → `255,0,255`)

ConfigWriter iterates all template files, performs string substitution, and writes to theme directory.

## Key Dependencies

**Runtime:**
- GJS (GNOME JavaScript bindings)
- GTK 4 + Libadwaita 1
- pywal (`python-pywal` package)
- omarchy theme manager (provides `omarchy-theme-set` command)

**Import pattern:**
```javascript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
```

## Signal Flow

```
PaletteGenerator → 'palette-generated' → ColorSynthesizer.setPalette()
ColorSynthesizer → 'color-changed' → (tracked internally)
BlueprintManager → 'blueprint-applied' → AetherWindow._loadBlueprint()
"Apply Theme" button → ConfigWriter.applyTheme()
```

## AUR Packaging

**Files:**
- PKGBUILD: Installs to `/usr/share/aether/`, creates launcher in `/usr/bin/aether`
- .SRCINFO: Generated via `makepkg --printsrcinfo > .SRCINFO`

**Release workflow:**
1. Tag release: `git tag -a v1.0.0 -m "Release v1.0.0"`
2. Push tag: `git push origin v1.0.0`
3. GitHub Actions (`.github/workflows/release.yml`) creates release automatically
4. Get sha256: `wget https://github.com/bjarneo/aether/archive/v1.0.0.tar.gz && sha256sum v1.0.0.tar.gz`
5. Update PKGBUILD sha256sums, regenerate .SRCINFO, push to AUR repo

## Important Notes

- Application ID is `com.aether.DesktopSynthesizer` (in main.js) but desktop file is `li.oever.aether.desktop`
- Wallpaper extraction requires pywal installed and in PATH
- Theme application requires `omarchy-theme-set` command available
- Default colors defined in `src/constants/colors.js` as fallback
- All file operations use GLib/Gio APIs (file-utils.js wrappers)
- Color utilities in color-utils.js handle hex/RGB/HSL conversions and adjustments
