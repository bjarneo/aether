# Color Extraction Algorithm

Aether uses an intelligent ImageMagick-based algorithm to extract 16 ANSI-compatible colors from any wallpaper.

## How It Works

### 1. Image Analysis

The algorithm first analyzes your wallpaper to determine its type:

| Type | Description | Strategy |
|------|-------------|----------|
| **Monochrome** | >70% low-saturation colors | Generates subtle grayscale palette |
| **Low Diversity** | >60% similar hues | Spreads colors across spectrum |
| **Chromatic** | Normal color variety | Extracts and maps to ANSI |

### 2. Color Extraction

ImageMagick extracts 32 dominant colors from the image:

```
magick image.jpg -resize 800x600> -colors 32 -format '%c' histogram:info:
```

The resize improves speed without affecting accuracy.

### 3. ANSI Color Mapping

Extracted colors are mapped to the 16-color ANSI palette:

| Index | Role | Description |
|-------|------|-------------|
| 0 | Background | Darkest color (light mode: lightest) |
| 1 | Red | Hue ~0° |
| 2 | Green | Hue ~120° |
| 3 | Yellow | Hue ~60° |
| 4 | Blue | Hue ~240° |
| 5 | Magenta | Hue ~300° |
| 6 | Cyan | Hue ~180° |
| 7 | White | Light gray |
| 8-14 | Bright variants | Boosted lightness (+18%) and saturation |
| 15 | Foreground | Brightest color (light mode: darkest) |

### 4. Readability Normalization

Colors are adjusted to ensure readability:

- **Dark backgrounds** (<20% lightness): Colors boosted to min 55% lightness
- **Light backgrounds** (>80% lightness): Colors capped at 45% lightness
- **Outlier detection**: Colors too different from the average are adjusted

## Light vs Dark Mode

Toggle light mode to swap background/foreground logic:

- **Dark mode**: color0 = darkest, color15 = lightest
- **Light mode**: color0 = lightest, color15 = darkest

## Caching

Extracted palettes are cached at `~/.cache/aether/color-cache/`:

- Cache key = MD5(path + mtime + mode)
- Instant re-extraction for unchanged images
- Edit wallpaper in WallpaperEditor bypasses cache

## Color Adjustments

After extraction, fine-tune with 12 adjustment sliders:

### Saturation & Vibrance

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Vibrance** | -50 to +50 | Intelligently boosts muted colors without over-saturating already vivid ones |
| **Saturation** | -100 to +100 | Uniformly increases/decreases color intensity across all colors |

### Tone & Exposure

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Contrast** | -30 to +30 | Increases/decreases difference between light and dark colors |
| **Brightness** | -30 to +30 | Shifts overall lightness up or down |
| **Shadows** | -50 to +50 | Adjusts dark tones only (negative = darker shadows, positive = lifted shadows) |
| **Highlights** | -50 to +50 | Adjusts bright tones only (negative = subdued, positive = brighter) |
| **Gamma** | 0.5 to 2.0 | Non-linear brightness curve (< 1 = darker midtones, > 1 = lighter midtones) |

### Levels

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Black Point** | -30 to +30 | Adjusts the darkest point (positive = deeper blacks, negative = lifted blacks) |
| **White Point** | -30 to +30 | Adjusts the brightest point (positive = brighter whites, negative = compressed whites) |

### Color Grading

| Adjustment | Range | Effect |
|------------|-------|--------|
| **Hue Shift** | -180° to +180° | Rotates all colors around the color wheel |
| **Temperature** | -50 to +50 | Warm (orange/yellow) ↔ Cool (blue) shift |
| **Tint** | -50 to +50 | Green ↔ Magenta shift (complements temperature) |

### Tips

- Double-click any slider to reset it to default
- Click on the value label to type a precise number
- Use **Reset Adjustments** button to reset all sliders at once
- Adjustments are saved with blueprints and restored when loading

## Technical Details

### Constants

```javascript
MONOCHROME_SATURATION_THRESHOLD = 15  // Below = grayscale
IDEAL_SATURATION_MIN = 30             // Preferred minimum
IDEAL_LIGHTNESS_MIN = 30              // Readable on dark
IDEAL_LIGHTNESS_MAX = 80              // Readable on light
BRIGHT_COLOR_LIGHTNESS_BOOST = 18     // For colors 9-14
```

### Performance

- Images scaled to 800x600 max for processing
- 85% quality for faster I/O
- Typical extraction: <500ms
