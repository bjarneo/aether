# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aether is a GTK/Libadwaita theming application for Omarchy. It provides a visual interface for creating and applying desktop themes through pywal color extraction, wallhaven.cc wallpaper browsing, and template-based configuration generation.

**Core workflow:**
1. User selects wallpaper (local file/drag-drop OR wallhaven.cc browser) → pywal extracts 16 ANSI colors
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
- Three-tab interface: "From Wallpaper", "Custom", "Find Wallpaper"
- Tab 1 (From Wallpaper): File picker/drag-drop, light/dark mode toggle, pywal integration
- Tab 2 (Custom): Manual palette creation with optional wallpaper reference
- Tab 3 (Find Wallpaper): WallpaperBrowser component for wallhaven.cc integration
- Calls `extractColorsFromWallpaper()` which runs `wal -n -s -t -e -i <image>`
- Light mode flag (`_lightMode`) saved to blueprints and restored on load
- Displays 16-color swatch grid with click-to-edit and lock feature
- Emits: `palette-generated` signal with 16 colors

**WallpaperBrowser** (`src/components/WallpaperBrowser.js`)
- Integrated wallhaven.cc API client for browsing/searching wallpapers
- Search interface: query input, category filters (General/Anime/People), sorting options
- Grid view with thumbnails (FlowBox, 2-3 columns)
- Pagination controls (prev/next, page indicator)
- Click wallpaper → downloads to `~/.cache/aether/wallhaven-wallpapers/` → emits `wallpaper-selected` signal → switches to "From Wallpaper" tab
- Settings dialog (gear icon) for API key configuration (stored in `~/.config/aether/wallhaven.json`)
- Thumbnail caching in `~/.cache/aether/wallhaven-thumbs/`

**ColorSynthesizer** (`src/components/ColorSynthesizer.js`)
- Displays color role assignments (background, foreground, color0-15) using Adw.ActionRow
- Auto-assigns palette colors to roles: background=color0, foreground=color15, etc.
- Each role has a Gtk.ColorDialogButton for manual adjustment
- Emits: `color-changed` signal on role modifications

**SettingsSidebar** (`src/components/SettingsSidebar.js`)
- Collapsible right sidebar with Adw.NavigationSplitView
- Contains: color adjustments (vibrance, contrast, brightness, hue shift, temperature, gamma)
- Color harmony generator (complementary, analogous, triadic, split-complementary, tetradic, monochromatic)
- Gradient generator (smooth transitions between two colors)
- Preset library (10 popular themes: Dracula, Nord, Gruvbox, etc.)
- Template settings and accessibility checker
- Emits: `adjustments-changed`, `adjustments-reset`, `preset-applied`, `harmony-generated`, `gradient-generated`

**BlueprintManager** (`src/components/BlueprintManager.js`)
- Saves/loads theme blueprints as JSON in `~/.config/aether/blueprints/`
- Blueprint format: `{ name, timestamp, palette: { wallpaper, colors, lightMode } }`
- Light mode setting now preserved in blueprints
- Emits: `blueprint-applied` signal

**ConfigWriter** (`src/utils/ConfigWriter.js`)
- Processes templates from `templates/` directory
- Replaces variables: `{background}`, `{color0}`, `{color5.strip}` (no #), `{color5.rgb}` (decimal RGB)
- Writes processed configs to `~/.config/omarchy/themes/aether/`
- Copies wallpaper to `~/.config/omarchy/themes/aether/backgrounds/`
- Executes `omarchy-theme-set aether` via `GLib.spawn_command_line_async()`

### Services

**wallpaper-service.js**: Executes pywal via `Gio.Subprocess`, reads colors from `~/.cache/wal/colors`, brightens colors 9-15 for better terminal contrast

**wallhaven-service.js**: HTTP client for wallhaven.cc API v1
- Uses `Soup.Session` (libsoup3) for async HTTP requests
- Methods: `search(params)`, `getWallpaper(id)`, `downloadWallpaper(url, destPath)`
- Supports API key authentication via `setApiKey()`
- Rate limiting: 45 requests/minute without API key
- Returns JSON responses with wallpaper metadata (resolution, file size, tags, colors, URLs)

**color-harmony.js**: Generates color harmonies (complementary, triadic, etc.) - used by SettingsSidebar

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
- libsoup3 (HTTP client for wallhaven API)
- pywal (`python-pywal` package)
- omarchy theme manager (provides `omarchy-theme-set` command)

**Import pattern:**
```javascript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Soup from 'gi://Soup?version=3.0';
```

## Signal Flow

```
PaletteGenerator → 'palette-generated' → ColorSynthesizer.setPalette()
WallpaperBrowser → 'wallpaper-selected' → PaletteGenerator._onWallpaperBrowserSelected()
ColorSynthesizer → 'color-changed' → AetherWindow._updateAccessibility()
BlueprintManager → 'blueprint-applied' → AetherWindow._loadBlueprint()
SettingsSidebar → 'adjustments-changed' → PaletteGenerator._applyAdjustments()
SettingsSidebar → 'preset-applied' → PaletteGenerator.applyPreset()
SettingsSidebar → 'harmony-generated' → PaletteGenerator.applyHarmony()
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

## Color Lock System

- Each color swatch in the 16-color grid can be locked/unlocked
- Locked colors are protected from adjustment slider changes (vibrance, contrast, etc.)
- Lock state tracked in `ColorSwatchGrid._lockedColors` array (boolean flags)
- Visual indicator: accent border on locked swatches, hover-to-reveal lock button
- NOT saved to blueprints (always reset to unlocked when loading)

## Configuration Storage

**User config locations:**
- Blueprints: `~/.config/aether/blueprints/*.json`
- Wallhaven API key: `~/.config/aether/wallhaven.json`

**Cache locations:**
- Wallhaven thumbnails: `~/.cache/aether/wallhaven-thumbs/`
- Downloaded wallpapers: `~/.cache/aether/wallhaven-wallpapers/`
- Pywal colors: `~/.cache/wal/colors`

**Theme output:**
- Generated configs: `~/.config/omarchy/themes/aether/`
- Wallpaper copy: `~/.config/omarchy/themes/aether/backgrounds/`

## Theming System

**IMPORTANT:** Aether has a comprehensive theming system that must be considered when adding new UI elements.

### Theme Manager (`src/services/theme-manager.js`)

The theme system uses CSS variables to allow user customization with live reload. When adding new UI elements, ensure they use the appropriate theme variables.

### Available CSS Variables (19 total)

**Buttons (5 variables):**
- `--aether-button-bg` - Normal button background
- `--aether-button-hover-bg` - Button hover background
- `--aether-button-active-bg` - Button pressed background
- `--aether-button-border` - Button border color
- `--aether-button-hover-border` - Button hover border color

**Backgrounds (6 variables):**
- `--aether-window-bg` - Main window background
- `--aether-view-bg` - Content area background
- `--aether-card-bg` - Card/panel background
- `--aether-headerbar-bg` - Header bar background
- `--aether-sidebar-bg` - Sidebar background
- `--aether-actionbar-bg` - Action bar (button wrapper) background

**Sliders (2 variables):**
- `--aether-slider-bg` - Slider handle/knob color
- `--aether-slider-trough-bg` - Slider track background

**Suggested Buttons (3 variables):**
- `--aether-suggested-button-bg` - Apply/Save button background
- `--aether-suggested-button-hover-bg` - Hover state
- `--aether-suggested-button-fg` - Text color

**Destructive Buttons (3 variables):**
- `--aether-destructive-button-bg` - Delete/Remove button background
- `--aether-destructive-button-hover-bg` - Hover state
- `--aether-destructive-button-fg` - Text color

### Unified Accent Color System

**CRITICAL:** All accent/interactive elements MUST use the suggested button color variables, NOT hardcoded blue colors.

Elements that use `--aether-suggested-button-bg` for consistency:
- Checkboxes (when checked)
- Switches/toggles (when active)
- Expander arrows (when expanded)
- Links
- Selections (highlighted text/items)
- Progress bars
- Spinners
- Any other "active" or "selected" state indicators

### When Adding New UI Elements

**1. For buttons:**
```javascript
// Use css_classes for proper theming
const myButton = new Gtk.Button({
    label: 'My Action',
    css_classes: ['suggested-action'], // or ['destructive-action']
});
```

**2. For custom backgrounds:**
```javascript
// Use theme variables, not hardcoded colors
const css = `
    * {
        background-color: var(--aether-card-bg);
        border-radius: 0px; /* Sharp corners for Hyprland style */
    }
`;
```

**3. For interactive elements (checkboxes, switches, etc.):**
- DO NOT hardcode blue colors (#89b4fa, etc.)
- Let the theme system handle colors via CSS in theme-manager.js
- If adding new interactive elements, add CSS rules to theme-manager.js

**4. For accent colors:**
```css
/* WRONG - hardcoded blue */
.my-element:active {
    color: #89b4fa;
}

/* RIGHT - uses theme accent */
.my-element:active {
    color: var(--aether-suggested-button-bg);
}
```

### Adding New CSS Rules

When adding new UI components that need theming, add CSS rules to `src/services/theme-manager.js` in the `_createBaseTheme()` method:

```javascript
// Example: Adding a new component
/* My New Component */
.my-component {
    background-color: var(--aether-card-bg);
}

.my-component:active {
    background-color: var(--aether-suggested-button-bg);
    color: var(--aether-suggested-button-fg);
}
```

### Design Principles

1. **Sharp Corners:** All UI elements use `border-radius: 0px` for Hyprland aesthetic
2. **Unified Accents:** All interactive/active states use suggested button color
3. **High Contrast:** Proper contrast between background and foreground colors
4. **Live Reload:** Changes to theme files apply instantly without restart
5. **No Hardcoded Colors:** Always use CSS variables from the theme system

### Testing New Components

After adding new UI elements:
1. Test with multiple themes (Gruvbox, Tokyo Night, Dracula, etc.)
2. Verify all interactive states use the correct theme colors
3. Check that accent colors match the suggested button color (not default blue)
4. Ensure sharp corners are maintained
5. Test with both light and dark system themes

### Theme Files Location

- **Base theme:** `~/.config/aether/theme.css` (auto-generated, do not edit)
- **User overrides:** `~/.config/aether/theme.override.css` (user editable)
- **Examples:** `examples/*-theme.override.css` (19 pre-made themes)
- **Documentation:** `THEMING.md` (complete theming guide)

### Common Mistakes to Avoid

❌ Hardcoding blue accent colors
❌ Using rounded corners (border-radius > 0)
❌ Not testing with different themes
❌ Forgetting to add CSS rules for new interactive elements
❌ Using inline styles instead of CSS variables
❌ Not documenting new theme variables

✅ Use theme variables for all colors
✅ Maintain sharp corners everywhere
✅ Test with multiple themes
✅ Add CSS rules to theme-manager.js
✅ Use suggested button color for all accents
✅ Document any new variables in override template

## Quick Reference: Adding New UI Elements

**Checklist when adding any new UI component:**

- [ ] Use appropriate CSS variable for background colors
- [ ] Set `border-radius: 0px` for all visual elements
- [ ] For buttons, use `css_classes: ['suggested-action']` or `['destructive-action']`
- [ ] For interactive elements (checkboxes, switches), add CSS rules in theme-manager.js
- [ ] Use `var(--aether-suggested-button-bg)` for all accent/active states
- [ ] Avoid hardcoded colors (especially blues like #89b4fa)
- [ ] Test with at least 3 different themes (Gruvbox, Tokyo Night, Dracula)
- [ ] Verify live reload works with your changes
- [ ] Check both light and dark mode compatibility
- [ ] Update theme variable documentation if adding new variables
- [ ] Add example CSS to theme examples if needed

**Quick Theme Variable Reference:**
```
Backgrounds: --aether-window-bg, --aether-view-bg, --aether-card-bg, --aether-sidebar-bg
Buttons: --aether-button-bg, --aether-button-hover-bg, --aether-button-border
Accents: --aether-suggested-button-bg (USE THIS FOR ALL BLUE/ACTIVE STATES)
Sliders: --aether-slider-bg, --aether-slider-trough-bg
Destructive: --aether-destructive-button-bg
```
