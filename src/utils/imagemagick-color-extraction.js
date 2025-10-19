import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {hexToRgb, rgbToHsl, hslToHex, rgbToHex} from './color-utils.js';
import {readFileAsText, writeTextToFile, fileExists, ensureDirectoryExists} from './file-utils.js';

/**
 * ImageMagick-based color extraction utility
 * Extracts dominant colors and generates ANSI palette with proper color mapping
 * Includes caching for improved performance
 */

/**
 * Gets the cache directory for color extraction
 * @returns {string} Cache directory path
 */
function getCacheDir() {
    const homeDir = GLib.get_home_dir();
    return GLib.build_filenamev([homeDir, '.cache', 'aether', 'color-cache']);
}

/**
 * Generates a cache key based on image path and modification time
 * @param {string} imagePath - Path to the image
 * @param {boolean} lightMode - Light mode flag
 * @returns {string|null} Cache key or null if error
 */
function getCacheKey(imagePath, lightMode) {
    try {
        const file = Gio.File.new_for_path(imagePath);
        const info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
        const mtime = info.get_modification_date_time();
        const mtimeSeconds = mtime.to_unix();

        // Create hash from path and mtime
        const dataString = `${imagePath}-${mtimeSeconds}-${lightMode ? 'light' : 'dark'}`;
        const checksum = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, dataString, -1);

        return checksum;
    } catch (e) {
        console.error('Error getting cache key:', e.message);
        return null;
    }
}

/**
 * Loads cached color palette if available
 * @param {string} cacheKey - Cache key
 * @returns {string[]|null} Cached palette or null
 */
function loadCachedPalette(cacheKey) {
    try {
        const cacheDir = getCacheDir();
        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);

        if (!fileExists(cachePath)) {
            return null;
        }

        const content = readFileAsText(cachePath);
        const data = JSON.parse(content);

        // Validate palette structure
        if (Array.isArray(data.palette) && data.palette.length === 16) {
            console.log('Using cached color extraction result');
            return data.palette;
        }

        return null;
    } catch (e) {
        console.error('Error loading cache:', e.message);
        return null;
    }
}

/**
 * Saves color palette to cache
 * @param {string} cacheKey - Cache key
 * @param {string[]} palette - Color palette to cache
 */
function savePaletteToCache(cacheKey, palette) {
    try {
        const cacheDir = getCacheDir();
        ensureDirectoryExists(cacheDir);

        const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);
        const data = {
            palette: palette,
            timestamp: Date.now(),
            version: 1,
        };

        writeTextToFile(cachePath, JSON.stringify(data, null, 2));
        console.log('Saved color extraction to cache');
    } catch (e) {
        console.error('Error saving to cache:', e.message);
    }
}

/**
 * Extracts the N most dominant colors from an image using ImageMagick
 * Optimized for speed with resize and quality settings
 * @param {string} imagePath - Path to the image file
 * @param {number} numColors - Number of colors to extract
 * @returns {Promise<string[]>} Array of hex colors
 */
function extractDominantColors(imagePath, numColors) {
    return new Promise((resolve, reject) => {
        try {
            // Use ImageMagick to extract dominant colors with performance optimizations
            // -resize 800x600>: Resize large images for faster processing (only if larger)
            // -scale: Use faster scaling algorithm
            // -colors N: reduce to N colors
            // -depth 8: use 8-bit color depth
            // -quality 85: Use lower quality for faster processing
            // -format "%c": output color histogram
            // histogram:info:- : output as text format
            const argv = [
                'magick',
                imagePath,
                '-scale', '800x600>',  // Fast resize for large images
                '-colors', numColors.toString(),
                '-depth', '8',
                '-quality', '85',
                '-format', '%c',
                'histogram:info:-',
            ];

            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (source, result) => {
                try {
                    const [, stdout, stderr] = source.communicate_utf8_finish(result);
                    const exitCode = source.get_exit_status();

                    if (exitCode !== 0) {
                        reject(new Error(`ImageMagick error: ${stderr}`));
                        return;
                    }

                    // Parse the histogram output
                    const colors = parseHistogramOutput(stdout);
                    if (colors.length === 0) {
                        reject(new Error('No colors extracted from image'));
                        return;
                    }

                    resolve(colors);
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Parses ImageMagick histogram output to extract hex colors
 * @param {string} output - Raw histogram output
 * @returns {string[]} Array of hex colors sorted by frequency (most dominant first)
 */
function parseHistogramOutput(output) {
    const lines = output.split('\n');
    const colorData = [];

    for (const line of lines) {
        // Match lines like: "123456: (255,128,64) #FF8040 srgb(255,128,64)"
        const match = line.match(/^\s*(\d+):\s*\([^)]+\)\s*(#[0-9A-Fa-f]{6})/);
        if (match) {
            const count = parseInt(match[1], 10);
            const hex = match[2].toUpperCase();
            colorData.push({hex, count});
        }
    }

    // Sort by frequency (most dominant first)
    colorData.sort((a, b) => b.count - a.count);

    return colorData.map(c => c.hex);
}

/**
 * Determines if a color is considered "dark" based on lightness
 * @param {string} hexColor - Hex color string
 * @returns {boolean} True if dark, false if light
 */
function isDarkColor(hexColor) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hsl.l < 50; // Colors with lightness < 50% are dark
}

/**
 * Detects if the extracted colors are mostly monochrome/grayscale
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if mostly monochrome
 */
function isMonochromeImage(colors) {
    let lowSaturationCount = 0;

    for (const color of colors) {
        const rgb = hexToRgb(color);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Count colors with very low saturation (< 15%)
        if (hsl.s < 15) {
            lowSaturationCount++;
        }
    }

    // If more than 70% of dominant colors are desaturated, it's monochrome
    return lowSaturationCount / colors.length > 0.7;
}

/**
 * Detects if colors are too similar to each other (low color diversity)
 * @param {string[]} colors - Array of hex colors
 * @returns {boolean} True if colors lack diversity
 */
function hasLowColorDiversity(colors) {
    const hueList = colors.map(color => {
        const rgb = hexToRgb(color);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {hue: hsl.h, saturation: hsl.s, lightness: hsl.l};
    });

    let similarCount = 0;

    // Compare each color with every other color
    for (let i = 0; i < hueList.length; i++) {
        for (let j = i + 1; j < hueList.length; j++) {
            const color1 = hueList[i];
            const color2 = hueList[j];

            // Skip if either is grayscale (very low saturation)
            if (color1.saturation < 15 || color2.saturation < 15) continue;

            // Calculate hue distance (circular)
            let hueDiff = Math.abs(color1.hue - color2.hue);
            if (hueDiff > 180) hueDiff = 360 - hueDiff;

            // Calculate lightness difference
            const lightnessDiff = Math.abs(color1.lightness - color2.lightness);

            // Colors are similar if hue is within 30° and lightness within 20%
            if (hueDiff < 30 && lightnessDiff < 20) {
                similarCount++;
            }
        }
    }

    // Calculate total possible comparisons (excluding grayscale)
    const chromaticColors = hueList.filter(c => c.saturation >= 15).length;
    const totalComparisons = (chromaticColors * (chromaticColors - 1)) / 2;

    if (totalComparisons === 0) return false;

    // If more than 60% of color pairs are similar, diversity is low
    return similarCount / totalComparisons > 0.6;
}

/**
 * Generates a subtle, balanced chromatic palette for low-diversity images
 * All colors get similar saturation levels to avoid some being strong and others subtle
 * @param {string[]} dominantColors - Array of dominant colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 ANSI colors with balanced saturation
 */
function generateSubtleBalancedPalette(dominantColors, lightMode) {
    // Find the average hue and saturation of dominant colors
    const colorData = dominantColors.map(color => {
        const rgb = hexToRgb(color);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {color, hue: hsl.h, saturation: hsl.s, lightness: hsl.l};
    });

    // Sort by lightness
    const sortedByLightness = [...colorData].sort(
        (a, b) => a.lightness - b.lightness
    );

    // Find background and foreground
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    // Calculate average hue from chromatic colors
    const chromaticColors = colorData.filter(c => c.saturation > 15);
    const avgHue = chromaticColors.length > 0
        ? chromaticColors.reduce((sum, c) => sum + c.hue, 0) / chromaticColors.length
        : darkest.hue;

    // Use subtle, balanced saturation (20-35% range)
    const baseSaturation = 28;

    const palette = new Array(16);

    // Color 0 (background) and Color 7 (foreground)
    if (lightMode) {
        palette[0] = lightest.color;
        palette[7] = darkest.color;
    } else {
        palette[0] = darkest.color;
        palette[7] = lightest.color;
    }

    // ANSI color hues
    const ansiHues = [
        0,      // red
        120,    // green
        60,     // yellow
        240,    // blue
        300,    // magenta
        180,    // cyan
    ];

    // Generate ANSI colors 1-6 with balanced subtle saturation
    // Use medium lightness range (45-65%)
    for (let i = 0; i < 6; i++) {
        const targetHue = ansiHues[i];
        const lightness = 50 + (i - 2.5) * 4; // Vary lightness slightly (42-58%)
        palette[i + 1] = hslToHex(targetHue, baseSaturation, lightness);
    }

    // Color 8: gray between background and colors
    const color8Lightness = lightMode
        ? Math.max(0, lightest.lightness - 20)
        : Math.min(100, darkest.lightness + 20);
    palette[8] = hslToHex(avgHue, baseSaturation * 0.5, color8Lightness);

    // Colors 9-14: Slightly more saturated and lighter/darker versions of 1-6
    const brightSaturation = baseSaturation + 8; // Still subtle, just slightly more
    for (let i = 0; i < 6; i++) {
        const targetHue = ansiHues[i];
        const baseLightness = 50 + (i - 2.5) * 4;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(0, Math.min(100, baseLightness + adjustment));
        palette[i + 9] = hslToHex(targetHue, brightSaturation, lightness);
    }

    // Color 15: Bright foreground
    palette[15] = lightMode
        ? hslToHex(avgHue, baseSaturation * 0.3, Math.max(0, darkest.lightness - 5))
        : hslToHex(avgHue, baseSaturation * 0.3, Math.min(100, lightest.lightness + 5));

    return palette;
}

/**
 * Generates a monochrome/grayscale ANSI palette
 * @param {string[]} grayColors - Array of grayscale colors sorted by dominance
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 monochrome ANSI colors
 */
function generateMonochromePalette(grayColors, lightMode) {
    // Sort by lightness
    const sortedByLightness = [...grayColors]
        .map(color => {
            const rgb = hexToRgb(color);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            return {color, lightness: hsl.l, hue: hsl.h};
        })
        .sort((a, b) => a.lightness - b.lightness);

    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    // Use the dominant hue (even if desaturated) for subtle tinting
    const baseHue = darkest.hue;

    // Generate grayscale palette with subtle tint
    const palette = new Array(16);

    if (lightMode) {
        // Light mode: light background, dark foreground
        palette[0] = lightest.color; // Background (lightest)
        palette[7] = darkest.color; // Foreground (darkest)
    } else {
        // Dark mode: dark background, light foreground
        palette[0] = darkest.color; // Background (darkest)
        palette[7] = lightest.color; // Foreground (lightest)
    }

    // Generate grayscale shades for ANSI colors 1-6
    // If background is dark, use lighter colors
    // If background is light, use darker colors
    if (lightMode) {
        // Light mode: dark background (foreground), so use darker shades for colors 1-6
        const startL = darkest.lightness + 10;
        const endL = Math.min(darkest.lightness + 40, lightest.lightness - 10);
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, 5, lightness);
        }
    } else {
        // Dark mode: dark background, so use lighter shades for colors 1-6
        const startL = Math.max(darkest.lightness + 30, lightest.lightness - 40);
        const endL = lightest.lightness - 10;
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, 5, lightness);
        }
    }

    // Color 8: gray between background and first color
    // Dark background (dark mode) → lighter shade
    // Light background (light mode) → darker shade
    let color8Lightness;
    if (lightMode) {
        // Light background → darker color 8
        color8Lightness = Math.max(0, darkest.lightness + 5);
    } else {
        // Dark background → lighter color 8
        color8Lightness = Math.min(100, lightest.lightness - 25);
    }
    palette[8] = hslToHex(baseHue, 3, color8Lightness);

    // Colors 9-14: Slightly lighter/darker versions of 1-6
    for (let i = 1; i <= 6; i++) {
        const rgb = hexToRgb(palette[i]);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const adjustment = lightMode ? -10 : 10;
        const newL = Math.max(0, Math.min(100, hsl.l + adjustment));
        palette[i + 8] = hslToHex(baseHue, 5, newL);
    }

    // Color 15: Bright white/black (opposite extreme)
    palette[15] = lightMode
        ? hslToHex(baseHue, 2, Math.max(0, darkest.lightness - 5))
        : hslToHex(baseHue, 2, Math.min(100, lightest.lightness + 5));

    return palette;
}

/**
 * Finds the best matching color for a specific ANSI color role from a pool
 * Prefers vibrant, well-saturated colors with good lightness (not too bright, not too dark)
 * @param {number} hueTarget - Target hue (0-360)
 * @param {string[]} colorPool - Available colors to choose from
 * @param {Set<number>} usedIndices - Already used color indices
 * @returns {number} Index of best match in colorPool
 */
function findBestColorMatch(hueTarget, colorPool, usedIndices) {
    let bestIndex = -1;
    let bestScore = Infinity;

    for (let i = 0; i < colorPool.length; i++) {
        if (usedIndices.has(i)) continue;

        const rgb = hexToRgb(colorPool[i]);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Calculate hue distance (circular)
        let hueDiff = Math.abs(hsl.h - hueTarget);
        if (hueDiff > 180) hueDiff = 360 - hueDiff;

        // Penalize very desaturated colors for chromatic slots
        const saturationPenalty = hsl.s < 25 ? 100 : 0;

        // Prefer colors with good saturation (40-90% is ideal)
        const saturationBonus = hsl.s >= 40 && hsl.s <= 90 ? -10 : 0;

        // Prefer colors with medium lightness (40-70% is ideal, not too bright)
        const lightnessPenalty =
            hsl.l < 30 ? 20 :  // Too dark
            hsl.l > 75 ? 30 :  // Too bright
            hsl.l >= 40 && hsl.l <= 70 ? -15 : 0; // Sweet spot

        const score = hueDiff + saturationPenalty + saturationBonus + lightnessPenalty;

        if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }

    return bestIndex !== -1 ? bestIndex : 0;
}

/**
 * Generates a lighter version of a color for bright ANSI slots
 * @param {string} hexColor - Base hex color
 * @returns {string} Lightened hex color
 */
function generateBrightVersion(hexColor) {
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Increase lightness by 15-20%, increase saturation slightly
    const newLightness = Math.min(100, hsl.l + 18);
    const newSaturation = Math.min(100, hsl.s * 1.1);

    return hslToHex(hsl.h, newSaturation, newLightness);
}

/**
 * Normalizes brightness of ANSI colors to match the overall theme
 * Adjusts outlier colors that are too dark/bright compared to the majority
 * Also ensures proper contrast against the background
 * @param {string[]} palette - Palette with colors 0-15
 * @returns {string[]} Normalized palette
 */
function normalizeBrightness(palette) {
    // Get background lightness
    const bg = hexToRgb(palette[0]);
    const bgHsl = rgbToHsl(bg.r, bg.g, bg.b);
    const bgLightness = bgHsl.l;

    // Determine if background is very dark or very light
    const isVeryDarkBg = bgLightness < 20;
    const isVeryLightBg = bgLightness > 80;

    // Analyze colors 1-7 (main ANSI colors + foreground, excluding 0 and 8)
    const colorIndices = [1, 2, 3, 4, 5, 6, 7];
    const ansiColors = colorIndices.map(i => {
        const rgb = hexToRgb(palette[i]);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {index: i, lightness: hsl.l, hue: hsl.h, saturation: hsl.s};
    });

    // Calculate average lightness
    const avgLightness = ansiColors.reduce((sum, c) => sum + c.lightness, 0) / ansiColors.length;

    // Determine if theme is mostly bright or mostly dark
    const isBrightTheme = avgLightness > 50;

    // Adjust based on background brightness first
    if (isVeryDarkBg) {
        // Very dark background - ensure colors 1-7 are bright enough
        const minLightness = 55; // Minimum lightness for readability

        for (const colorInfo of ansiColors) {
            if (colorInfo.lightness < minLightness) {
                const rgb = hexToRgb(palette[colorInfo.index]);
                const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

                const adjustedLightness = minLightness + (colorInfo.index * 3); // Vary slightly
                console.log(`Adjusting color ${colorInfo.index} for dark background: ${hsl.l.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);

                palette[colorInfo.index] = hslToHex(hsl.h, hsl.s, adjustedLightness);

                // Update bright versions for colors 1-6
                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    const brightIndex = colorInfo.index + 8;
                    palette[brightIndex] = generateBrightVersion(palette[colorInfo.index]);
                }
            }
        }
    } else if (isVeryLightBg) {
        // Very light background - ensure colors 1-7 are dark enough
        const maxLightness = 45; // Maximum lightness for readability

        for (const colorInfo of ansiColors) {
            if (colorInfo.lightness > maxLightness) {
                const rgb = hexToRgb(palette[colorInfo.index]);
                const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

                const adjustedLightness = maxLightness - (colorInfo.index * 2); // Vary slightly
                console.log(`Adjusting color ${colorInfo.index} for light background: ${hsl.l.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`);

                palette[colorInfo.index] = hslToHex(hsl.h, hsl.s, Math.max(25, adjustedLightness));

                // Update bright versions for colors 1-6
                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    const brightIndex = colorInfo.index + 8;
                    palette[brightIndex] = generateBrightVersion(palette[colorInfo.index]);
                }
            }
        }
    } else {
        // Normal background - apply outlier detection
        // Find outliers (colors that differ by more than 25% from average)
        const threshold = 25;
        const outliers = ansiColors.filter(c =>
            Math.abs(c.lightness - avgLightness) > threshold
        );

        // Adjust outliers
        for (const outlier of outliers) {
            const rgb = hexToRgb(palette[outlier.index]);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

            let adjustedLightness;

            if (isBrightTheme && hsl.l < avgLightness - threshold) {
                // Bright theme with dark outlier - make it brighter
                adjustedLightness = avgLightness - 10; // Slightly below average for variety
                console.log(`Adjusting dark outlier color ${outlier.index} from ${hsl.l.toFixed(1)}% to ${adjustedLightness.toFixed(1)}%`);
            } else if (!isBrightTheme && hsl.l > avgLightness + threshold) {
                // Dark theme with bright outlier - make it darker
                adjustedLightness = avgLightness + 10; // Slightly above average for variety
                console.log(`Adjusting bright outlier color ${outlier.index} from ${hsl.l.toFixed(1)}% to ${adjustedLightness.toFixed(1)}%`);
            } else {
                continue; // No adjustment needed
            }

            palette[outlier.index] = hslToHex(hsl.h, hsl.s, adjustedLightness);

            // Also adjust the corresponding bright version (colors 9-14)
            if (outlier.index >= 1 && outlier.index <= 6) {
                const brightIndex = outlier.index + 8;
                palette[brightIndex] = generateBrightVersion(palette[outlier.index]);
            }
        }
    }

    return palette;
}

/**
 * Extracts colors from wallpaper using ImageMagick and generates ANSI palette
 * Uses caching to avoid re-processing the same image
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {Promise<string[]>} Array of 16 ANSI colors
 */
export async function extractColorsWithImageMagick(imagePath, lightMode = false) {
    try {
        // Check cache first
        const cacheKey = getCacheKey(imagePath, lightMode);
        if (cacheKey) {
            const cachedPalette = loadCachedPalette(cacheKey);
            if (cachedPalette) {
                return cachedPalette;
            }
        }

        // Extract more colors than we need for better selection
        const dominantColors = await extractDominantColors(imagePath, 32);

        if (dominantColors.length < 8) {
            throw new Error('Not enough colors extracted from image');
        }

        // Check if image is mostly monochrome/grayscale
        if (isMonochromeImage(dominantColors)) {
            console.log('Detected monochrome/grayscale image - generating grayscale palette');
            const palette = generateMonochromePalette(dominantColors, lightMode);
            if (cacheKey) savePaletteToCache(cacheKey, palette);
            return palette;
        }

        // Check if chromatic image has low color diversity (similar colors)
        if (hasLowColorDiversity(dominantColors)) {
            console.log('Detected low color diversity - generating subtle balanced palette');
            const palette = generateSubtleBalancedPalette(dominantColors, lightMode);
            if (cacheKey) savePaletteToCache(cacheKey, palette);
            return palette;
        }

        console.log('Detected diverse chromatic image - generating vibrant colorful palette');

        // ANSI color slots and their target hues
        // 0: background (darkest or lightest depending on mode)
        // 1: red (0°)
        // 2: green (120°)
        // 3: yellow (60°)
        // 4: blue (240°)
        // 5: magenta (300°)
        // 6: cyan (180°)
        // 7: foreground (lightest or darkest depending on mode)
        // 8: bright background
        // 9-14: bright versions of 1-6
        // 15: bright foreground

        const ansiTargets = [
            {slot: 1, hue: 0, name: 'red'},
            {slot: 2, hue: 120, name: 'green'},
            {slot: 3, hue: 60, name: 'yellow'},
            {slot: 4, hue: 240, name: 'blue'},
            {slot: 5, hue: 300, name: 'magenta'},
            {slot: 6, hue: 180, name: 'cyan'},
        ];

        // Find background color (color0) - darkest if dark mode, lightest if light mode
        let bgIndex = 0;
        let bgLightness = lightMode ? -1 : 101;

        for (let i = 0; i < dominantColors.length; i++) {
            const rgb = hexToRgb(dominantColors[i]);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

            if (lightMode) {
                if (hsl.l > bgLightness) {
                    bgLightness = hsl.l;
                    bgIndex = i;
                }
            } else {
                if (hsl.l < bgLightness) {
                    bgLightness = hsl.l;
                    bgIndex = i;
                }
            }
        }

        const color0 = dominantColors[bgIndex];
        const usedIndices = new Set([bgIndex]);

        // Find foreground color (color7) - opposite of background
        let fgIndex = 0;
        let fgLightness = lightMode ? 101 : -1;

        for (let i = 0; i < dominantColors.length; i++) {
            if (usedIndices.has(i)) continue;

            const rgb = hexToRgb(dominantColors[i]);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

            if (lightMode) {
                if (hsl.l < fgLightness) {
                    fgLightness = hsl.l;
                    fgIndex = i;
                }
            } else {
                if (hsl.l > fgLightness) {
                    fgLightness = hsl.l;
                    fgIndex = i;
                }
            }
        }

        const color7 = dominantColors[fgIndex];
        usedIndices.add(fgIndex);

        // Find best matches for ANSI colors 1-6
        let palette = new Array(16);
        palette[0] = color0;
        palette[7] = color7;

        for (const target of ansiTargets) {
            const matchIndex = findBestColorMatch(
                target.hue,
                dominantColors,
                usedIndices
            );
            palette[target.slot] = dominantColors[matchIndex];
            usedIndices.add(matchIndex);
        }

        // Generate color8 (bright black/gray)
        // If color0 is dark, make color8 brighter
        // If color0 is light, make color8 darker
        const rgb0 = hexToRgb(color0);
        const hsl0 = rgbToHsl(rgb0.r, rgb0.g, rgb0.b);

        let color8Lightness;
        if (isDarkColor(color0)) {
            // Dark background - make color8 a lighter gray
            color8Lightness = Math.min(100, hsl0.l + 20);
        } else {
            // Light background - make color8 a darker gray
            color8Lightness = Math.max(0, hsl0.l - 20);
        }

        palette[8] = hslToHex(hsl0.h, hsl0.s * 0.5, color8Lightness);

        // Generate bright versions (9-14) of colors 1-6
        for (let i = 1; i <= 6; i++) {
            palette[i + 8] = generateBrightVersion(palette[i]);
        }

        // Generate color15 (bright white) - brighter version of foreground
        palette[15] = generateBrightVersion(color7);

        // Normalize brightness to ensure consistency across all colors
        palette = normalizeBrightness(palette);

        // Save to cache
        if (cacheKey) savePaletteToCache(cacheKey, palette);

        return palette;
    } catch (e) {
        throw new Error(`ImageMagick color extraction failed: ${e.message}`);
    }
}

/**
 * Callback-based wrapper for extractColorsWithImageMagick
 * @param {string} imagePath - Path to wallpaper image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @param {Function} onSuccess - Callback when colors are extracted (colors)
 * @param {Function} onError - Callback when extraction fails (error)
 */
export function extractColorsFromWallpaperIM(
    imagePath,
    lightMode,
    onSuccess,
    onError
) {
    extractColorsWithImageMagick(imagePath, lightMode)
        .then(colors => onSuccess(colors))
        .catch(error => onError(error));
}
