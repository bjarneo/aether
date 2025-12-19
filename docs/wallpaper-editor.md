# Wallpaper Editor

Edit your wallpaper with professional filters before extracting colors.

## Opening the Editor

1. Load a wallpaper in the Palette Editor
2. Click the **edit icon** (pencil) next to the Extract button
3. The full-screen editor opens

## Filter Categories

### Basic Adjustments

| Filter | Range | Description |
|--------|-------|-------------|
| Blur | 0-5px | Gaussian blur |
| Brightness | 50-150% | Overall lightness |
| Contrast | 50-150% | Color difference |
| Saturation | 0-150% | Color intensity |
| Hue Shift | 0-360° | Rotate color wheel |

### Effects

| Filter | Range | Description |
|--------|-------|-------------|
| Sepia | 0-100% | Vintage brown tone |
| Invert | 0-100% | Negative colors |

### Advanced (Pro Tab)

| Filter | Range | Description |
|--------|-------|-------------|
| Exposure | -100 to 100 | Camera exposure simulation |
| Sharpen | 0-100 | Edge enhancement |
| Vignette | 0-100% | Darken edges |
| Grain | 0-10 | Film grain overlay |
| Shadows | -100 to 100 | Shadow detail |
| Highlights | -100 to 100 | Highlight recovery |

### Color Tone

Add a color cast to your image:

1. Choose a preset color (Blue, Cyan, Green, etc.)
2. Or pick a custom color
3. Adjust intensity with the slider

## Quick Presets

12 one-click presets for instant looks:

| Preset | Effect |
|--------|--------|
| Muted | Reduced saturation, slight blur |
| Dramatic | High contrast, deep shadows |
| Soft | Gentle blur, reduced contrast |
| Vintage | Sepia, faded look |
| Vibrant | Boosted saturation |
| Faded | Low contrast, lifted blacks |
| Cool | Blue tone, high contrast |
| Warm | Orange tone, soft glow |
| Cinematic | Teal shadows, warm highlights |
| Film | Grain, muted colors |
| Crisp | Sharpened, high contrast |
| Portrait | Soft skin tones, vignette |

## Preview

- **Real-time preview**: See changes as you adjust
- **Click and hold**: View original image temporarily
- **Debounced updates**: 75ms delay for smooth performance

## Workflow

1. Adjust filters to your liking
2. Click **Apply** to save the edited wallpaper
3. Edited image saves to `~/.cache/aether/`
4. Color extraction runs on the edited version
5. Click **Cancel** to discard changes

## Tips

- Start with a preset, then fine-tune
- Use vignette to draw focus to center
- Grain adds texture to flat images
- Desaturate busy wallpapers for cleaner palettes
