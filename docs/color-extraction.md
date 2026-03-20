# Color Extraction Algorithm

Aether uses a pure Go median-cut algorithm to extract 16 ANSI-compatible colors from any wallpaper.

## How It Works

### 1. Image Sampling

The image is loaded and scaled to 300x300 (preserving aspect ratio) using bilinear interpolation. Pixels are then sampled for analysis.

### 2. Median-Cut Quantization

The sampled pixels are fed into a median-cut algorithm that recursively splits the color space along its longest axis, producing dominant color clusters. This is more accurate than histogram-based approaches for identifying perceptually distinct colors.

### 3. Palette Mode

The dominant colors are then processed through one of eight palette generators:

- `normal` (default) - Balanced extraction
- `monochromatic` - Single-hue variations
- `analogous` - Adjacent colors on the color wheel
- `pastel` - Soft, muted colors
- `material` - Google Material-inspired
- `colorful` - High saturation, vibrant
- `muted` - Desaturated, subtle
- `bright` - High brightness colors

### 4. ANSI Color Mapping

Colors are mapped to the 16-color ANSI palette:

| Index | Role | Description |
|-------|------|-------------|
| 0 | Background | Darkest color (light mode: lightest) |
| 1 | Red | Hue ~0 degrees |
| 2 | Green | Hue ~120 degrees |
| 3 | Yellow | Hue ~60 degrees |
| 4 | Blue | Hue ~240 degrees |
| 5 | Magenta | Hue ~300 degrees |
| 6 | Cyan | Hue ~180 degrees |
| 7 | White | Light gray |
| 8-14 | Bright variants | Boosted lightness and saturation |
| 15 | Bright White | Brightest color (light mode: darkest) |

### 5. Readability Normalization

Colors are adjusted to ensure readability against the background.

## Light vs Dark Mode

Toggle light mode to swap darkest/lightest anchors:

- **Dark mode**: color0 = darkest, color15 = lightest
- **Light mode**: color0 = lightest, color15 = darkest

## Caching

Extracted palettes are cached at `~/.cache/aether/color-cache/`:

- Cache key = MD5(path + mtime + mode)
- Instant re-extraction for unchanged images
- Editing a wallpaper in the Wallpaper Editor bypasses cache

## Color Adjustments

After extraction, fine-tune with 12 adjustment sliders:

### Saturation and Vibrance

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Vibrance** | -50 to +50 | Intelligently boosts muted colors without over-saturating vivid ones |
| **Saturation** | -100 to +100 | Uniformly increases/decreases color intensity |

### Tone and Exposure

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Contrast** | -30 to +30 | Difference between light and dark colors |
| **Brightness** | -30 to +30 | Overall lightness shift |
| **Shadows** | -50 to +50 | Dark tones only |
| **Highlights** | -50 to +50 | Bright tones only |
| **Gamma** | 0.5 to 2.0 | Non-linear brightness curve |

### Levels

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Black Point** | -30 to +30 | Adjusts the darkest point |
| **White Point** | -30 to +30 | Adjusts the brightest point |

### Color Grading

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Hue Shift** | -180 to +180 degrees | Rotates all colors around the color wheel |
| **Temperature** | -50 to +50 | Warm (orange/yellow) to cool (blue) shift |
| **Tint** | -50 to +50 | Green to magenta shift |

### Tips

- Double-click any slider to reset it to default
- Click on the value label to type a precise number
- Use **Reset Adjustments** button to reset all sliders at once
- Adjustments are saved with blueprints and restored when loading
