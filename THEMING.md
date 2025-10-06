# Aether Theming Guide

Aether includes a powerful theming system with live reload capabilities that allows you to customize buttons and backgrounds without restarting the application.

## Quick Start

1. **Launch Aether** - Theme files are automatically created on first launch
2. **Click the Theme Button** (🎨 icon in the action bar) to open `theme.override.css`
3. **Edit the CSS** - Make your changes and save
4. **Watch it apply** - Changes are automatically applied when you save the file

## Theme File Structure

Aether uses a two-file theming system:

### `theme.css` (Base Theme)
- Contains default theme definitions and CSS variable declarations
- **DO NOT EDIT** - This file is managed by Aether
- Loads `theme.override.css` at the end

### `theme.override.css` (Your Customizations)
- **THIS IS THE FILE YOU EDIT**
- Contains your custom CSS variable overrides
- Changes here take precedence over base theme
- Includes helpful comments listing all available CSS variables

Both files are located at:
```
~/.config/aether/theme.css
~/.config/aether/theme.override.css  ← Edit this one!
```

## Live Reload

The theme system monitors both theme files for changes. Whenever you save `theme.override.css`, the changes are automatically applied to the running application within milliseconds. No restart required!

## Available CSS Variables

The `theme.override.css` file includes comprehensive comments listing all available variables. Here's a quick reference:

### Button Colors

```css
:root {
    /* Normal buttons */
    --aether-button-bg: transparent;
    --aether-button-hover-bg: alpha(@accent_bg_color, 0.1);
    --aether-button-active-bg: alpha(@accent_bg_color, 0.2);
    --aether-button-border: alpha(@borders, 0.3);
    --aether-button-hover-border: @accent_bg_color;
}
```

### Background Colors

```css
:root {
    --aether-window-bg: @window_bg_color;
    --aether-view-bg: @view_bg_color;
    --aether-card-bg: @card_bg_color;
    --aether-headerbar-bg: @headerbar_bg_color;
}
```

### Suggested Action Buttons (Save, Apply, OK)

```css
:root {
    --aether-suggested-button-bg: @accent_bg_color;
    --aether-suggested-button-hover-bg: shade(@accent_bg_color, 1.1);
    --aether-suggested-button-fg: @accent_fg_color;
}
```

### Destructive Action Buttons (Delete, Reset, Remove)

```css
:root {
    --aether-destructive-button-bg: @destructive_bg_color;
    --aether-destructive-button-hover-bg: shade(@destructive_bg_color, 1.1);
    --aether-destructive-button-fg: @destructive_fg_color;
}
```

## Using GTK Named Colors

You can reference GTK's built-in theme colors using the `@` syntax:

- `@window_bg_color` - Main window background
- `@view_bg_color` - Content area background
- `@card_bg_color` - Card/panel background
- `@accent_bg_color` - Accent color (blue by default)
- `@destructive_bg_color` - Red/destructive color
- `@borders` - Border color
- `@accent_fg_color` - Foreground text for accent backgrounds

## Color Functions

GTK CSS supports several color manipulation functions:

### alpha()
Adjust opacity:
```css
alpha(@accent_bg_color, 0.5)  /* 50% opacity */
```

### shade()
Lighten or darken:
```css
shade(@accent_bg_color, 1.2)  /* 20% lighter */
shade(@accent_bg_color, 0.8)  /* 20% darker */
```

### mix()
Blend two colors:
```css
mix(@accent_bg_color, @window_bg_color, 0.5)  /* 50/50 mix */
```

## Example Customizations

All examples below should be added to `~/.config/aether/theme.override.css`:

### Hyprland-Style Dark Theme
```css
:root {
    --aether-button-bg: #1e1e2e;
    --aether-button-hover-bg: #313244;
    --aether-button-active-bg: #45475a;
    --aether-button-border: #6c7086;
    --aether-button-hover-border: #89b4fa;
    
    --aether-window-bg: #11111b;
    --aether-card-bg: #1e1e2e;
}
```

### Minimal Transparent Buttons
```css
:root {
    --aether-button-bg: transparent;
    --aether-button-hover-bg: alpha(@accent_bg_color, 0.05);
    --aether-button-active-bg: alpha(@accent_bg_color, 0.15);
    --aether-button-border: transparent;
    --aether-button-hover-border: alpha(@borders, 0.5);
}
```

### High Contrast
```css
:root {
    --aether-button-bg: #000000;
    --aether-button-hover-bg: #ffffff;
    --aether-button-border: #ffffff;
    --aether-button-hover-border: #000000;
}

button:hover {
    color: #000000;
}
```

## Advanced Selectors

You can also target specific UI elements directly in `theme.override.css`:

```css
/* All buttons */
button {
    padding: 8px 16px;
    font-weight: bold;
}

/* Action bar buttons specifically */
actionbar button {
    min-width: 100px;
}

/* Toggle buttons */
togglebutton:checked {
    background-color: @accent_bg_color;
}
```

## Tips

1. **Keep the override file open** - Use a text editor with auto-save for instant updates
2. **Don't edit theme.css** - Always edit `theme.override.css` for your customizations
3. **Use GTK Inspector** - Press Ctrl+Shift+D in the app to inspect elements
4. **Test incrementally** - Make small changes and verify before continuing
5. **Backup your overrides** - Copy `theme.override.css` before making major changes
6. **All CSS variables are listed** - Open `theme.override.css` to see all available variables with descriptions

## Workflow Example

```bash
# Open the override file
xdg-open ~/.config/aether/theme.override.css

# Or click the 🎨 button in Aether to open it automatically

# Edit the file, for example:
:root {
    --aether-button-bg: #1e1e2e;
    --aether-window-bg: #11111b;
}

# Save the file → Changes apply instantly in Aether!
```

## Troubleshooting

### Theme not applying
- Check for CSS syntax errors (missing semicolons, brackets, etc)
- Verify the file is saved properly
- Check the console output for error messages
- Make sure you're editing `theme.override.css`, not `theme.css`

### Colors look wrong
- Ensure you're using valid color formats (hex, rgb, or GTK named colors)
- Check that CSS variables are defined in `:root`
- Verify proper `var()` syntax when using variables

### Reset to defaults
```bash
# Delete both theme files to regenerate
rm ~/.config/aether/theme.css
rm ~/.config/aether/theme.override.css
# Restart Aether to regenerate
```

Or to keep base theme but reset overrides:
```bash
# Just delete the override file
rm ~/.config/aether/theme.override.css
# Restart Aether to regenerate empty override file
```

## Integration with System Theme

The default theme uses GTK named colors (like `@accent_bg_color`) which automatically adapt to your system theme. To make your custom theme responsive to system theme changes:

1. Use GTK named colors as much as possible
2. Apply color functions (alpha, shade) instead of hardcoded values
3. Avoid absolute color values unless you want consistent appearance

---

**Happy Theming!** 🎨
