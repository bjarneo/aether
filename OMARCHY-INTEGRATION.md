<p align="center">
  <img src="icon.png" alt="Aether Icon" width="128" height="128">
</p>

# Aether + Omarchy Integration

Aether now integrates with `omarchy` theme manager for seamless desktop theming.

## How It Works

### 1. Template-Based System

Aether uses the template files in `templates/` directory:
- `hyprland.conf` - Hyprland colors and settings
- `kitty.conf` - Terminal colors
- `waybar.css` - Status bar styling
- `wofi.css`, `walker.css`, etc. - Other app configs

Templates use variable substitution:
- `{background}`, `{foreground}` - Base colors
- `{color0}` through `{color15}` - ANSI terminal colors
- `{color5.strip}` - Strips `#` from hex colors (for certain formats)
- `{corner_radius}`, `{animation_speed}` - Settings

### 2. Theme Generation Flow

```
Wallpaper → Extract 16 ANSI Colors → Map to Roles → Apply to Templates → omarchy
```

**Steps:**
1. User drops wallpaper into Aether
2. Aether extracts 16 ANSI colors (0-15)
3. Colors auto-assign to UI roles (background, foreground, accent, etc.)
4. User adjusts colors/settings as needed
5. User clicks **"Apply Theme"**
6. Aether:
   - Creates `~/.config/omarchy/themes/aether/`
   - Copies wallpaper to `~/.config/omarchy/themes/aether/backgrounds/`
   - Processes all templates with color variables
   - Writes processed configs to theme directory
   - Runs `omarchy-theme-set aether`

### 3. Directory Structure

After applying a theme:

```
~/.config/omarchy/themes/aether/
├── backgrounds/
│   └── wallpaper.png          # Your wallpaper
├── hyprland.conf              # Processed template
├── kitty.conf                 # Processed template
├── waybar.css                 # Processed template
├── wofi.css                   # Processed template
└── ...                        # All other templates
```

## Key Changes from Previous Version

### Old Approach (❌ Removed)
- Directly modified user config files
- Created `.aether-backup` files
- Used marker blocks like `# AETHER_COLORS_START`
- Required manual reloading of services

### New Approach (✅ Current)
- Uses omarchy template system
- Non-destructive (doesn't touch user configs)
- Clean theme directory per theme
- Single command applies everything: `omarchy-theme-set aether`

## Color Mapping

### ANSI Color Palette (0-15)
Extracted from wallpaper in this order:
- **0** - Black (darkest)
- **1** - Red
- **2** - Green
- **3** - Yellow
- **4** - Blue
- **5** - Magenta
- **6** - Cyan
- **7** - White
- **8** - Bright Black (gray)
- **9** - Bright Red
- **10** - Bright Green
- **11** - Bright Yellow
- **12** - Bright Blue
- **13** - Bright Magenta
- **14** - Bright Cyan
- **15** - Bright White (brightest)

### UI Role Assignment
- **Background**: color0 (Black)
- **Foreground**: color15 (Bright White)
- **Accent**: color4 (Blue)
- **Accent Secondary**: color5 (Magenta)
- **Surface**: color8 (Bright Black/Gray)
- **Terminal Colors**: color0-color7 (normal), color8-color15 (bright)

## Using Aether

1. **Launch Aether:**
   ```bash
   ./aether
   ```

2. **Extract Colors:**
   - Click folder icon or drag a wallpaper
   - Aether extracts 16 colors automatically

3. **Customize (Optional):**
   - Adjust any color by clicking the color buttons
   - Tweak corner radius, fonts, animations

4. **Apply Theme:**
   - Click **"Apply Theme"** button
   - Aether generates theme in `~/.config/omarchy/themes/aether/`
   - Runs `omarchy-theme-set aether`
   - Your desktop updates instantly!

5. **Save Blueprint (Optional):**
   - Click "Save Blueprint" to save for later
   - Reload from sidebar anytime

## Benefits

✅ **Non-Destructive** - Never modifies your personal configs
✅ **Clean** - All theme files in one directory
✅ **Portable** - Share theme folder with others
✅ **Reversible** - Switch themes with `omarchy-theme-set <name>`
✅ **Complete** - Updates all apps at once via omarchy

## Requirements

- `omarchy` theme manager
- `omarchy-theme-set` command available
- Template files in `Aether/templates/`

## Troubleshooting

**Theme not applying:**
```bash
# Check if omarchy-theme-set exists
which omarchy-theme-set

# Manually apply theme
omarchy-theme-set aether

# Check theme directory
ls -la ~/.config/omarchy/themes/aether/
```

**Colors look wrong:**
- Aether extracts colors from wallpaper automatically
- Some wallpapers may not have all hue ranges
- Manually adjust colors in Color Synthesizer section
- Click "Apply Theme" again

**Wallpaper not showing:**
- Check `~/.config/omarchy/themes/aether/backgrounds/`
- Ensure wallpaper was selected before applying theme
