# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Aether is a GTK4/Libadwaita theming application for Omarchy. It extracts colors from wallpapers using ImageMagick and applies cohesive themes across the desktop via template-based configuration generation.

**Core workflow:**
1. User selects wallpaper (local/drag-drop/wallhaven.cc browser)
2. (Optional) Edit wallpaper with filters before extraction
3. ImageMagick extracts 16 ANSI colors, auto-classifies image type
4. User customizes colors/settings in GUI
5. "Apply Theme" processes templates → writes to `~/.config/aether/theme/` → runs `omarchy-theme-set aether`

## Running the Application

```bash
./aether              # Development
gjs -m src/main.js    # Alternative
npm start             # Via npm
```

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/main.js` | Entry point (bootstrapping) |
| `src/AetherApplication.js` | GTK Application class, CLI handling |
| `src/AetherWindow.js` | Main window layout, component coordination |
| `src/state/ThemeState.js` | Centralized reactive state (colors, wallpaper, adjustments) |
| `src/utils/ConfigWriter.js` | Template processing and theme application |
| `src/utils/imagemagick-color-extraction.js` | Color extraction algorithm |
| `src/services/service-locator.js` | Dependency injection registry |

### Directory Structure

```
src/
├── components/          # UI components (PaletteEditor, WallpaperEditor, etc.)
├── state/               # ThemeState reactive state manager
├── services/            # Business logic (blueprints, wallhaven, favorites)
├── utils/               # Utilities (file ops, color conversion, UI builders)
└── constants/           # Colors, presets, UI constants
templates/               # Config templates for applications
```

### Component Responsibilities

- **PaletteEditor**: Wallpaper selection, color swatch grid, palette generation
- **WallpaperEditor**: Image filter editor (blur, brightness, etc.) before extraction
- **ColorSynthesizer**: Color role assignments (background, foreground, color0-15)
- **SettingsSidebar**: Adjustments, presets, harmony generator, neovim themes
- **BlueprintsView**: Saved theme management

### State Management

`ThemeState.js` is the single source of truth. Components subscribe via GObject signals:
```javascript
themeState.on('colors-changed', (colors) => { /* update UI */ });
```

### Services

Access via `getService('serviceName')` from `service-locator.js`:
- `blueprintService` - Theme persistence
- `favoritesService` - Favorite wallpapers
- `wallhavenService` - Wallhaven.cc API
- `thumbnailService` - Image thumbnail caching

## Template System

Templates in `templates/` use variable substitution:

| Variable | Output |
|----------|--------|
| `{color5}` | `#ff00ff` |
| `{color5.strip}` | `ff00ff` |
| `{color5.rgb}` | `255,0,255` |
| `{background}`, `{foreground}` | Hex colors |

ConfigWriter processes all templates and writes to `~/.config/aether/theme/`.

## Dependencies

**Required:**
- GJS (GNOME JavaScript bindings)
- GTK 4 + Libadwaita 1
- libsoup3
- ImageMagick (`magick` command)
- omarchy (`omarchy-theme-set` command)

**Import pattern:**
```javascript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
```

## Configuration Storage

| Type | Location |
|------|----------|
| Blueprints | `~/.config/aether/blueprints/*.json` |
| Favorites | `~/.config/aether/favorites.json` |
| Generated theme | `~/.config/aether/theme/` |
| Downloaded wallpapers | `~/.local/share/aether/wallpapers/` |
| Thumbnails/cache | `~/.cache/aether/` |

## Theming Guidelines

**Use GTK CSS classes instead of hardcoded colors:**
```javascript
// Good
const button = new Gtk.Button({ css_classes: ['suggested-action'] });
const card = new Gtk.Box({ css_classes: ['card'] });

// Bad - don't hardcode colors
const button = new Gtk.Button({ css_name: 'my-button' }); // with custom CSS
```

GTK named colors are defined in `templates/aether.override.css`. Key colors:
- `accent_bg_color`, `window_bg_color`, `view_bg_color`
- `destructive_bg_color`, `success_bg_color`, `warning_bg_color`

Sharp corners (`border-radius: 0`) are applied globally via theme-manager.js.

## Code Standards

### Conventions
- ES Modules with named exports (default for main class)
- JSDoc on all exported functions
- `async`/`await` for async operations
- Private methods prefixed with `_`
- Use `ui-builders.js` for widget creation
- Use `file-utils.js` for file operations

### Patterns

**Early returns over nested if:**
```javascript
async function loadFile(path) {
    if (!path) return null;
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null)) return null;
    // ... proceed
}
```

**Use services for I/O:**
```javascript
// Good - delegate to service
const path = await getService('wallhavenService').downloadWallpaper(url);

// Bad - I/O in component
const response = await fetch(url);
```

**Immutable state updates:**
```javascript
const newColors = [...existingColors, newColor];
const newState = { ...oldState, isLoading: false };
```

### File Size Limits
- Components: 400-500 lines max
- Services/Utils: 300-400 lines max
- Split larger files into focused modules

## Key Signals

```
ThemeState → 'colors-changed' → Components update
PaletteEditor → 'palette-generated' → ColorSynthesizer.setPalette()
WallpaperEditor → 'wallpaper-applied' → PaletteEditor.loadWallpaper()
SettingsSidebar → 'adjustments-changed' → ThemeState.setAdjustments()
"Apply Theme" → ConfigWriter.applyTheme()
```

## CLI Commands

```bash
aether --list-blueprints           # List saved themes
aether --apply-blueprint "name"    # Apply theme by name
aether --generate ~/wallpaper.jpg  # Extract and apply from wallpaper
```
