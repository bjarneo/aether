# Aether Theme Examples

This directory contains example theme override files that you can use as a starting point for customizing Aether.

## How to Use

1. Choose a theme file from this directory
2. Copy it to `~/.config/aether/theme.override.css`
3. The theme will apply automatically!

Example:
```bash
cp examples/gruvbox-dark-theme.override.css ~/.config/aether/theme.override.css
```

## Available Themes

All themes include complete configuration of the 15 CSS variables for buttons and backgrounds.

### Dark Themes

- **andromeda-theme.override.css** - Sci-Fi Dreams with vibrant neon accents
- **ayu-mirage-theme.override.css** - Modern Elegance with muted pastels
- **catppuccin-mocha-theme.override.css** - Soothing Pastel (Mocha variant)
- **dracula-theme.override.css** - Classic Dracula with purple accents
- **everforest-theme.override.css** - Nature Inspired with earthy greens
- **github-dark-theme.override.css** - GitHub's official dark theme
- **gruvbox-dark-theme.override.css** - Retro Groove with warm colors
- **horizon-theme.override.css** - Red Sunset with vibrant pinks
- **kanagawa-theme.override.css** - The Great Wave with traditional colors
- **monokai-pro-theme.override.css** - Sublime Classic with neon colors
- **nightfox-theme.override.css** - Night Coding with cool blues
- **nord-theme.override.css** - Arctic Bluish with frost colors
- **oceanic-next-theme.override.css** - Ocean Inspired with aqua tones
- **one-dark-theme.override.css** - Atom Inspired classic theme
- **palenight-theme.override.css** - Material Theme with purple hues
- **rose-pine-theme.override.css** - Rosé Pine with soft florals
- **solarized-dark-theme.override.css** - Precision Colors (dark variant)
- **synthwave-84-theme.override.css** - Retro Neon with 80s vibes
- **tokyo-night-theme.override.css** - Night Coding with Tokyo colors

## Creating Your Own

1. Start with an example theme or an empty override file
2. Edit the CSS variables in the `:root` section
3. Add custom CSS rules as needed
4. Save and watch changes apply instantly!

See `THEMING.md` in the project root for detailed documentation.

## Color Variables

All themes can customize these variables:

**Buttons:**
- `--aether-button-bg`
- `--aether-button-hover-bg`
- `--aether-button-active-bg`
- `--aether-button-border`
- `--aether-button-hover-border`
- `--aether-suggested-button-bg`
- `--aether-suggested-button-hover-bg`
- `--aether-suggested-button-fg`
- `--aether-destructive-button-bg`
- `--aether-destructive-button-hover-bg`
- `--aether-destructive-button-fg`

**Backgrounds:**
- `--aether-window-bg`
- `--aether-view-bg`
- `--aether-card-bg`
- `--aether-headerbar-bg`
- `--aether-sidebar-bg`
- `--aether-actionbar-bg`

**Sliders:**
- `--aether-slider-bg`
- `--aether-slider-trough-bg`

## Contributing

Feel free to contribute your own theme examples! Create a pull request with:
- Your theme file (named `yourtheme-theme.override.css`)
- A description of the theme
- Any special features or customizations
