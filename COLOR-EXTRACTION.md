<p align="center">
  <img src="icon.png" alt="Aether Icon" width="128" height="128">
</p>

# Color Extraction via pywal

Aether uses **pywal** (Python Wallpaper) to extract colors from wallpapers. This proven tool analyzes images and generates coordinated 16-color ANSI palettes optimized for terminals and desktop theming.

## How It Works

### 1. User Selects Wallpaper
- User clicks folder icon or drags image into Aether
- Supported formats: PNG, JPEG, WebP

### 2. Aether Invokes pywal
```bash
wal -n -s -t -e -i /path/to/wallpaper.png
```

Flags explained:
- `-n` - Don't reload applications (Aether will do this via omarchy)
- `-s` - Skip setting the wallpaper
- `-t` - Skip reloading terminals
- `-e` - Skip reloading Xresources
- `-i` - Input image path

### 3. pywal Analyzes the Image
pywal's imagemagick backend:
1. Samples dominant colors from the image
2. Applies color quantization to reduce noise
3. Sorts colors by frequency and visual importance
4. Generates 16 ANSI colors (0-15) following standard terminal palette structure
5. Ensures good contrast between foreground/background
6. Creates variations (normal + bright) for each primary color

### 4. Aether Reads Generated Colors
```javascript
// Aether reads from pywal's cache
const colorsPath = '~/.cache/wal/colors';
const colors = readFile(colorsPath).split('\n'); // 16 colors
```

### 5. Display & Customize
- Colors displayed in visual palette (8 swatches per row)
- User can click any color to fine-tune with color picker
- Modified colors override pywal's output

## pywal Color Palette Structure

### ANSI Color Indices (0-15)

pywal generates colors following the standard terminal color scheme:

| Index | Name            | Purpose                    |
|-------|-----------------|----------------------------|
| 0     | Black           | Background, dark elements  |
| 1     | Red             | Errors, warnings           |
| 2     | Green           | Success, growth            |
| 3     | Yellow          | Highlights, attention      |
| 4     | Blue            | Links, primary actions     |
| 5     | Magenta         | Special elements           |
| 6     | Cyan            | Information, code          |
| 7     | White           | Foreground, text           |
| 8     | Bright Black    | Comments, gray             |
| 9     | Bright Red      | Brighter errors            |
| 10    | Bright Green    | Brighter success           |
| 11    | Bright Yellow   | Brighter highlights        |
| 12    | Bright Blue     | Brighter links             |
| 13    | Bright Magenta  | Brighter special           |
| 14    | Bright Cyan     | Brighter info              |
| 15    | Bright White    | Bright text                |

### Aether's Color Mapping

Aether extends pywal's palette with semantic roles:

```javascript
{
  background: colors[0],   // Black
  foreground: colors[15],  // Bright White
  color0: colors[0],       // Direct mapping
  color1: colors[1],
  // ... color2-14 ...
  color15: colors[15]
}
```

These 18 colors (background + foreground + 16 ANSI) are editable in Aether's UI.

## Example Scenarios

### Scenario 1: Colorful Wallpaper
**Wallpaper**: Sunset (orange, pink, purple, blue)

**pywal extracts**:
- Dominant warm tones (orange, pink)
- Cool accents (purple, blue)
- Dark shadows for blacks
- Bright highlights for whites
- Balanced saturation across the palette

**Result**: Rich, vibrant theme matching the sunset's warmth

### Scenario 2: Nature Wallpaper
**Wallpaper**: Forest (dark green, brown, earth tones)

**pywal extracts**:
- Dark greens and browns for base colors
- Lighter greens for highlights
- Muted earth tones for variety
- Natural, organic color harmony

**Result**: Calm, earthy theme perfect for productivity

### Scenario 3: Monochrome/Minimal Wallpaper
**Wallpaper**: Black & white architecture

**pywal extracts**:
- Grayscale palette from image
- Various shades from dark to light
- Subtle tonal variations
- Clean, professional aesthetic

**Result**: Elegant monochromatic theme, sophisticated look

## Technical Details

### Aether's Integration with pywal

```javascript
// PaletteGenerator.js

extractColors(imagePath) {
    // Run pywal command
    const argv = ['wal', '-n', '-s', '-t', '-e', '-i', imagePath];
    const proc = Gio.Subprocess.new(argv, ...flags);

    // Wait for completion
    proc.wait_async(null, (source, result) => {
        // Read generated colors
        const colors = this.readWalColors();
        this.setPalette(colors);
    });
}

readWalColors() {
    // Read from pywal's cache
    const colorsPath = '~/.cache/wal/colors';
    const contents = readFile(colorsPath);

    // Parse colors (one per line)
    return contents.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim().startsWith('#')
            ? line.trim()
            : '#' + line.trim()
        );
}
```

### Why pywal?

1. **Proven Algorithm**: Battle-tested by thousands of users
2. **Optimized for Terminals**: Designed specifically for ANSI color schemes
3. **Good Contrast**: Automatically ensures readable foreground/background
4. **Consistent Results**: Reliable color extraction across different images
5. **Maintained Project**: Active development and bug fixes
6. **Community Standard**: Works with many existing themes and tools

## Customization Layer

Aether adds a visual customization layer on top of pywal:

### 1. Visual Palette Display
- Shows all 16 colors in a clickable grid
- Color swatches with hover effects
- Tooltip showing ANSI color names

### 2. Color Picker Integration
- Click any swatch to open GTK ColorChooserWidget
- Live preview of color changes
- Palette colors shown in picker for reference
- Easy fine-tuning of pywal's output

### 3. Persistent Overrides
- User-modified colors override pywal defaults
- Saved in blueprints for later reuse
- Original pywal colors always available by re-running extraction

## Benefits of This Approach

✅ **Proven Foundation**: pywal's algorithm is mature and reliable
✅ **Easy Customization**: Visual editing of extracted colors
✅ **No Reinventing**: Leverage existing, well-tested tools
✅ **Community Compatible**: Works with existing pywal themes
✅ **Fast Extraction**: pywal is optimized for performance
✅ **Consistent Results**: Predictable color generation

---

**Result**: Best of both worlds - automatic color extraction with manual refinement, all in a beautiful visual interface.
