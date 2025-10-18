# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aether is a GTK/Libadwaita theming application for Omarchy. It provides a visual interface for creating and applying desktop themes through pywal color extraction, wallhaven.cc wallpaper browsing, and template-based configuration generation.

**Core workflow:**
1. User selects wallpaper (local file/drag-drop OR wallhaven.cc browser)
2. **(Optional)** Edit wallpaper with filters (blur, brightness, sepia, etc.) before extraction
3. Pywal extracts 16 ANSI colors from wallpaper (or filtered version)
4. Colors auto-assign to UI roles (background, foreground, color0-15)
5. User customizes colors/settings in GUI
6. "Apply Theme" processes templates → writes to `~/.config/omarchy/themes/aether/` → runs `omarchy-theme-set aether`

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
- Two-tab interface: "Palette Editor", "Find Wallpaper"
- Tab 1 (Palette Editor): Unified interface for wallpaper + custom palette creation
  - File picker/drag-drop for wallpaper selection
  - **Edit wallpaper button** (icon button next to Extract) - opens WallpaperEditor for filter application
  - Manual extract button (no auto-extraction)
  - 16-color swatch grid with click-to-edit and lock feature
  - Loads default Catppuccin-inspired colors on startup
- Tab 2 (Find Wallpaper): WallpaperBrowser component for wallhaven.cc integration
- Calls `extractColorsFromWallpaper()` which runs `wal -n -s -t -e -i <image>`
- Light mode flag (`_lightMode`) controlled by SettingsSidebar, saved to blueprints, affects pywal extraction
- Emits: `palette-generated` signal with 16 colors, `open-wallpaper-editor` signal with wallpaper path

**WallpaperEditor** (`src/components/WallpaperEditor.js`)
- **NEW FEATURE:** Apply image filters to wallpapers before color extraction
- Full-screen editor view (replaces main content when active)
- Real-time CSS preview + ImageMagick processing for final output
- Features:
  - **Preview area** (left): Large wallpaper preview with CSS filters applied in real-time
    - Click-and-hold to temporarily view original (no filters)
    - Hint: "Hold click to view original"
  - **Filter controls** (right sidebar): Adjustable filters with sliders
  - **Header actions**: Reset filters (undo icon), Apply (process and return), Cancel (discard and return)
- **Available filters:**
  - Blur (0-10px) - 5x multiplier for ImageMagick to match CSS preview
  - Brightness (50-150%)
  - Contrast (50-150%)
  - Saturation (0-150%)
  - Hue Shift (0-360°)
  - Sepia (0-100%) - 1.5x boost for ImageMagick to match CSS intensity
  - Invert (0-100%)
  - Color Tone presets (Blue, Cyan, Green, Yellow, Orange, Red, Pink, Purple) with intensity control
- **Quick presets** (8 total, displayed in 2 rows at top):
  - Muted, Dramatic, Soft, Vintage
  - Vibrant, Faded, Cool, Warm
- **Processing:**
  - Generates unique timestamped filename: `processed-wallpaper-{timestamp}.png`
  - Saves to `~/.cache/aether/processed-wallpaper-*.png`
  - Bypasses pywal cache with unique filenames (forces fresh color extraction)
- **Sub-components:**
  - `src/components/wallpaper-editor/FilterControls.js` - All filter UI controls
  - `src/components/wallpaper-editor/PreviewArea.js` - Preview with click-and-hold gesture
- **Filter utilities:**
  - `src/utils/image-filter-utils.js` - Core filter logic, ImageMagick command building, cache management
  - `src/utils/icon-utils.js` - Custom SVG icon loading and registration with GTK IconTheme
- **Custom icon:** `src/icons/image-edit-symbolic.svg` - Registered with GTK for theme-aware coloring
- **Reset behavior:** Filters automatically reset to defaults each time editor is opened
- Emits: `wallpaper-applied` signal with processed wallpaper path (or original if cancelled)

**WallpaperBrowser** (`src/components/WallpaperBrowser.js`)
- Integrated wallhaven.cc API client for browsing/searching wallpapers
- Search interface: query input, category filters (General/Anime/People), sorting options
- Grid view with thumbnails (FlowBox, 2-3 columns)
- Pagination controls (prev/next, page indicator)
- Click wallpaper → downloads to `~/.cache/aether/wallhaven-wallpapers/` → emits `wallpaper-selected` signal → switches to "Palette Editor" tab
- Settings dialog (gear icon) for API key configuration (stored in `~/.config/aether/wallhaven.json`)
- Thumbnail caching in `~/.cache/aether/wallhaven-thumbs/`

**LocalWallpaperBrowser** (`src/components/LocalWallpaperBrowser.js`)
- Browses local wallpapers from `~/Wallpapers` directory
- Features:
  - Automatic wallpaper discovery (scans for image files: jpg, jpeg, png, webp)
  - Grid view with thumbnail previews (FlowBox, 2-3 columns)
  - Thumbnail generation and caching via `thumbnailService`
  - Favorites integration - star icon on cards to add/remove favorites
  - Refresh button to rescan directory
  - Empty state with helpful message if no wallpapers found
- Click wallpaper → emits `wallpaper-selected` signal → switches to "Palette Editor" tab
- Async loading with loading spinner
- Emits: `wallpaper-selected`, `favorites-changed` signals

**FavoritesView** (`src/components/FavoritesView.js`)
- Displays favorited wallpapers from both local and wallhaven sources
- Features:
  - Grid view with thumbnail previews
  - Remove from favorites button on each card
  - Support for both local files and wallhaven URLs
  - Auto-download for wallhaven favorites (if not already cached)
  - Empty state with "No favorites yet" message
- Click wallpaper → emits `wallpaper-selected` signal → switches to "Palette Editor" tab
- Loads favorites from `~/.config/aether/favorites.json`
- Emits: `wallpaper-selected` signal

**Tab Navigation in "Find Wallpaper"**
The "Find Wallpaper" tab contains a sub-navigation with 3 tabs:
1. **Wallhaven** - Browse online wallpapers from wallhaven.cc
2. **Local** - Browse wallpapers from ~/Wallpapers directory
3. **Favorites** - Quick access to favorited wallpapers from any source

**ColorSynthesizer** (`src/components/ColorSynthesizer.js`)
- Displays color role assignments (background, foreground, color0-15) using Adw.ActionRow
- Auto-assigns palette colors to roles: background=color0, foreground=color15, etc.
- Each role has a Gtk.ColorDialogButton for manual adjustment
- Emits: `color-changed` signal on role modifications

**SettingsSidebar** (`src/components/SettingsSidebar.js`)
- Collapsible right sidebar with Adw.NavigationSplitView
- Contains multiple sections:
  - Light Mode toggle (for pywal light/dark scheme extraction)
  - Color adjustments (vibrance, contrast, brightness, hue shift, temperature, gamma)
  - Color harmony generator (complementary, analogous, triadic, split-complementary, tetradic, monochromatic)
  - Gradient generator (smooth transitions between two colors)
  - Preset library (10 popular themes: Dracula, Nord, Gruvbox, etc.)
  - Neovim theme selector (37 LazyVim-compatible themes)
  - Template settings (enable/disable optional templates)
  - Accessibility checker
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

**favorites-service.js**: Manages favorited wallpapers
- Stores favorites in `~/.config/aether/favorites.json`
- Supports both local file paths and wallhaven URLs
- Methods: `addFavorite(wallpaper)`, `removeFavorite(path)`, `getFavorites()`, `isFavorite(path)`
- Auto-saves on changes

**thumbnail-service.js**: Generates and caches thumbnails for local wallpapers
- Creates thumbnails for large images to improve UI performance
- Caches generated thumbnails to avoid regeneration
- Uses GdkPixbuf for image scaling
- Async thumbnail generation

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
- ImageMagick (`magick` command) - required for wallpaper filter processing
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
PaletteGenerator → 'open-wallpaper-editor' → AetherWindow._showWallpaperEditor()
WallpaperBrowser → 'wallpaper-selected' → PaletteGenerator._onWallpaperBrowserSelected()
WallpaperEditor → 'wallpaper-applied' → AetherWindow._hideWallpaperEditor() → PaletteGenerator.loadWallpaper()
ColorSynthesizer → 'color-changed' → AetherWindow._updateAccessibility()
BlueprintManager → 'blueprint-applied' → AetherWindow._loadBlueprint()
SettingsSidebar → 'adjustments-changed' → PaletteGenerator._applyAdjustments()
SettingsSidebar → 'preset-applied' → PaletteGenerator.applyPreset()
SettingsSidebar → 'harmony-generated' → PaletteGenerator.applyHarmony()
"Apply Theme" button → ConfigWriter.applyTheme()
```

## Wallpaper Editor Signal Flow

```
FilterControls → 'filter-changed' → WallpaperEditor → PreviewArea.updateFilters()
FilterControls → 'preset-applied' → WallpaperEditor → PreviewArea.updateFilters()
FilterControls → 'reset-filters' → WallpaperEditor → PreviewArea.clearFilters()
PreviewArea (click gesture) → temporarily disables filters → shows original
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
- **Wallpaper filter processing requires ImageMagick (`magick` command) installed**
- Theme application requires `omarchy-theme-set` command available
- Default colors defined in `src/constants/colors.js` as fallback
- All file operations use GLib/Gio APIs (file-utils.js wrappers)
- Color utilities in color-utils.js handle hex/RGB/HSL conversions and adjustments
- **Custom icons registered with GTK IconTheme** (`src/icons/` directory)

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
- **Favorites:** `~/.config/aether/favorites.json`
- Settings: `~/.config/aether/settings.json`

**Cache locations:**
- Wallhaven thumbnails: `~/.cache/aether/wallhaven-thumbs/`
- Downloaded wallpapers: `~/.cache/aether/wallhaven-wallpapers/`
- **Processed wallpapers:** `~/.cache/aether/processed-wallpaper-{timestamp}.png` (not auto-cleaned)
- **Local wallpaper thumbnails:** `~/.cache/aether/thumbnails/` (generated by thumbnailService)
- Pywal colors: `~/.cache/wal/colors`

**Theme output:**
- Generated configs: `~/.config/omarchy/themes/aether/`
- Wallpaper copy: `~/.config/omarchy/themes/aether/backgrounds/`

## Theming System

**IMPORTANT:** Aether uses standard GTK/Adwaita theming with `@define-color` variables.

### Theme Manager (`src/services/theme-manager.js`)

The theme system manages CSS file monitoring and live reload. Theming is done through standard GTK named colors using `@define-color` statements.

### How Theming Works

1. **Base theme**: `~/.config/aether/theme.css` (auto-generated, imports override)
2. **User overrides**: `~/.config/aether/theme.override.css` (user editable or symlinked)
3. **Template system**: `templates/aether.override.css` and `templates/gtk.css` define color mappings
4. **Live reload**: File monitors detect changes and reload CSS automatically

When you apply a theme in Aether:
- `templates/aether.override.css` → processed → `~/.config/omarchy/themes/aether/aether.override.css`
- Symlink created: `~/.config/aether/theme.override.css` → omarchy theme file
- Aether's UI updates automatically with the new colors

### GTK Named Colors (Standard)

Aether uses standard GTK/Adwaita color names. Key colors used in templates:

**Accent/Interactive:**
- `@define-color accent_bg_color` - Suggested buttons, checkboxes, switches, links
- `@define-color accent_fg_color` - Accent foreground text
- `@define-color accent_color` - Accent color variant

**Windows/Views:**
- `@define-color window_bg_color` - Main window background
- `@define-color window_fg_color` - Main window text
- `@define-color view_bg_color` - Content area background
- `@define-color view_fg_color` - Content area text

**UI Elements:**
- `@define-color headerbar_bg_color` - Header bar background
- `@define-color card_bg_color` - Card/panel background
- `@define-color borders` - Border colors

**Actions:**
- `@define-color destructive_bg_color` - Delete/remove buttons
- `@define-color success_bg_color` - Success states
- `@define-color warning_bg_color` - Warning states
- `@define-color error_bg_color` - Error states

See `templates/aether.override.css` for the complete list of color mappings from palette colors to GTK variables.

### When Adding New UI Elements

**1. For buttons:**
```javascript
// Use css_classes for proper GTK theming
const myButton = new Gtk.Button({
    label: 'My Action',
    css_classes: ['suggested-action'], // or ['destructive-action']
});
// GTK automatically applies accent_bg_color to .suggested-action
// GTK automatically applies destructive_bg_color to .destructive-action
```

**2. For custom styling needs:**
```javascript
// GTK widgets inherit theme colors automatically
// No custom CSS needed in most cases
const card = new Gtk.Box({
    css_classes: ['card'], // Uses card_bg_color from theme
});
```

**3. For interactive elements:**
- DO NOT hardcode colors (#89b4fa, etc.)
- Use GTK's built-in CSS classes: `suggested-action`, `destructive-action`, `card`, `toolbar`, etc.
- GTK automatically applies appropriate named colors to standard widgets
- Checkboxes, switches, and links use `accent_bg_color` by default

**4. Sharp corners:**
All UI elements automatically get `border-radius: 0px` via theme-manager.js's global CSS
No need to set this per-widget

### Design Principles

1. **Sharp Corners:** All UI elements get `border-radius: 0px` globally (Hyprland aesthetic)
2. **GTK Native Theming:** Use GTK's built-in CSS classes instead of custom styling
3. **Live Reload:** Theme file changes apply instantly via file monitors
4. **No Hardcoded Colors:** Let GTK's named colors handle all theming
5. **Template-based:** Color mappings defined in `templates/aether.override.css`

### Testing New Components

After adding new UI elements:
1. Verify widgets use GTK CSS classes (`.suggested-action`, `.card`, etc.)
2. Check that no colors are hardcoded in component code
3. Test that sharp corners are applied (should be automatic)
4. Apply a theme in Aether and verify the new widget updates correctly
5. Edit `~/.config/aether/theme.override.css` manually to test live reload

### Theme Files Location

- **Base theme:** `~/.config/aether/theme.css` (auto-generated, imports override)
- **User overrides:** `~/.config/aether/theme.override.css` (editable or symlinked to omarchy theme)
- **Template (source):** `templates/aether.override.css` (defines color → GTK variable mapping)
- **Template (GTK apps):** `templates/gtk.css` (for system-wide GTK theming when enabled)
- **Generated override:** `~/.config/omarchy/themes/aether/aether.override.css` (processed template)

### Common Mistakes to Avoid

❌ Hardcoding colors in component code (#89b4fa, etc.)
❌ Creating custom CSS variables (use GTK's `@define-color` instead)
❌ Setting border-radius per-widget (already global)
❌ Using inline styles instead of CSS classes
❌ Not using GTK's built-in CSS classes

✅ Use GTK CSS classes: `.suggested-action`, `.destructive-action`, `.card`
✅ Let GTK handle theming automatically
✅ Rely on named colors from templates
✅ Trust the global sharp corners CSS
✅ Test with "Apply Theme" to verify color mappings

## Quick Reference: Adding New UI Elements

**Checklist when adding any new UI component:**

- [ ] Use GTK CSS classes instead of custom styling
- [ ] Avoid hardcoded colors (let GTK's `@define-color` handle it)
- [ ] For buttons, use `css_classes: ['suggested-action']` or `['destructive-action']`
- [ ] For containers, use `css_classes: ['card']`, `['toolbar']`, etc.
- [ ] Don't set `border-radius` (already global)
- [ ] Test by applying a theme in Aether

**GTK Named Colors Quick Reference:**
```
Accent: accent_bg_color, accent_fg_color
Windows: window_bg_color, window_fg_color, view_bg_color, view_fg_color
UI: headerbar_bg_color, card_bg_color, borders
Actions: destructive_bg_color, success_bg_color, warning_bg_color, error_bg_color
```

See `templates/aether.override.css` for complete color → GTK variable mappings.
