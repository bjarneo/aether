import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Utility functions for applying image filters using ImageMagick
 */

/**
 * Default filter values matching CSS filter defaults
 */
export const DEFAULT_FILTERS = {
    // Basic adjustments
    blur: 0, // 0-5px
    brightness: 100, // 0-200%
    contrast: 100, // 0-200%
    saturation: 100, // 0-200%
    hueRotate: 0, // 0-360 degrees

    // Effects
    sepia: 0, // 0-100%
    invert: 0, // 0-100%
    oilPaint: 0, // 0-10 (oil paint radius)

    // Color tone system
    tone: null, // tone type (hue value) or null
    toneAmount: 0, // 0-100%
    toneSaturation: 100, // Saturation for custom tones (0-100)
    toneLightness: 50, // Lightness for custom tones (0-100)

    // Advanced filters
    exposure: 0, // -100 to 100 (0 = no change)
    vignette: 0, // 0-100% (darkness of vignette)
    sharpen: 0, // 0-100 (sharpening intensity)
    grain: 0, // 0-10 (monochrome grain amount)
    shadows: 0, // -100 to 100 (lift shadows)
    highlights: 0, // -100 to 100 (recover highlights)
    tint: 0, // 0-100% (colorize amount)
    tintColor: '#3b82f6', // Tint color (hex)
};

/**
 * Color tone presets matching common color themes
 */
export const TONE_PRESETS = [
    {name: 'Blue', hue: 210, color: '#3b82f6'},
    {name: 'Cyan', hue: 180, color: '#06b6d4'},
    {name: 'Green', hue: 120, color: '#22c55e'},
    {name: 'Yellow', hue: 50, color: '#eab308'},
    {name: 'Orange', hue: 30, color: '#f97316'},
    {name: 'Red', hue: 0, color: '#ef4444'},
    {name: 'Pink', hue: 330, color: '#ec4899'},
    {name: 'Purple', hue: 270, color: '#a855f7'},
];

/**
 * Quick filter presets for common effects
 * Note: Presets now auto-reset all filters to defaults before applying,
 * so you only need to specify the filters you want to modify
 */
export const FILTER_PRESETS = [
    {
        name: 'Muted',
        brightness: 95,
        contrast: 85,
        saturation: 60,
        exposure: -10,
    },
    {
        name: 'Dramatic',
        brightness: 90,
        contrast: 130,
        saturation: 110,
    },
    {
        name: 'Soft',
        brightness: 105,
        contrast: 90,
        saturation: 95,
        exposure: 10,
    },
    {
        name: 'Vintage',
        brightness: 95,
        contrast: 110,
        saturation: 70,
        sepia: 30,
    },
    {
        name: 'Vibrant',
        brightness: 105,
        contrast: 115,
        saturation: 140,
        exposure: 10,
    },
    {
        name: 'Faded',
        brightness: 110,
        contrast: 75,
        saturation: 65,
        exposure: 20,
    },
    {
        name: 'Cool',
        contrast: 105,
        saturation: 95,
        hueRotate: 200,
    },
    {
        name: 'Warm',
        contrast: 105,
        saturation: 95,
        hueRotate: 20,
    },
    {
        name: 'Cinematic',
        contrast: 120,
        saturation: 85,
        shadows: 20,
        highlights: -15,
        vignette: 35,
    },
    {
        name: 'Film',
        contrast: 95,
        saturation: 90,
        grain: 2.5,
        sepia: 15,
        vignette: 20,
    },
    {
        name: 'Crisp',
        contrast: 110,
        saturation: 105,
        sharpen: 40,
        exposure: 5,
    },
    {
        name: 'Portrait',
        brightness: 102,
        contrast: 95,
        saturation: 92,
        shadows: 15,
        vignette: 25,
    },
];

/**
 * Check if any filters are active (different from defaults)
 */
export function hasActiveFilters(filters) {
    return (
        filters.blur > 0 ||
        filters.brightness !== 100 ||
        filters.contrast !== 100 ||
        filters.saturation !== 100 ||
        filters.hueRotate !== 0 ||
        filters.sepia > 0 ||
        filters.invert > 0 ||
        filters.oilPaint > 0 ||
        (filters.tone !== null && filters.toneAmount > 0) ||
        filters.exposure !== 0 ||
        filters.vignette > 0 ||
        filters.sharpen > 0 ||
        filters.grain > 0 ||
        filters.shadows !== 0 ||
        filters.highlights !== 0 ||
        filters.tint > 0
    );
}

/**
 * Build CSS filter string from filter values
 * @param {Object} filters - Filter values
 * @returns {string} CSS filter string
 */
export function buildCssFilterString(filters) {
    const parts = [];

    if (filters.blur > 0) {
        parts.push(`blur(${filters.blur}px)`);
    }

    // Exposure - applied as brightness multiplier (matches ImageMagick -evaluate Multiply)
    if (filters.exposure !== 0) {
        const exposureMult = 1 + filters.exposure / 100;
        parts.push(`brightness(${exposureMult})`);
    }

    // Brightness adjustment (separate from exposure)
    if (filters.brightness !== 100) {
        parts.push(`brightness(${filters.brightness / 100})`);
    }

    if (filters.contrast !== 100) {
        parts.push(`contrast(${filters.contrast / 100})`);
    }
    if (filters.saturation !== 100) {
        parts.push(`saturate(${filters.saturation / 100})`);
    }
    if (filters.hueRotate !== 0) {
        parts.push(`hue-rotate(${filters.hueRotate}deg)`);
    }
    if (filters.sepia > 0) {
        parts.push(`sepia(${filters.sepia / 100})`);
    }
    if (filters.invert > 0) {
        parts.push(`invert(${filters.invert / 100})`);
    }

    // Apply tone by using sepia + hue-rotate + saturate
    if (filters.tone !== null && filters.toneAmount > 0) {
        parts.push(`sepia(${filters.toneAmount / 100})`);
        // Sepia's natural hue is ~38 degrees (brown)
        const adjustedHue = filters.tone - 38;
        parts.push(`hue-rotate(${adjustedHue}deg)`);
        parts.push(`saturate(${1 + filters.toneAmount / 200})`);
    }

    return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Build ImageMagick command arguments for applying filters
 * @param {string} inputPath - Source image path
 * @param {string} outputPath - Destination path
 * @param {Object} filters - Filter values
 * @returns {Array<string>} Command arguments for ImageMagick
 */
export function buildImageMagickCommand(inputPath, outputPath, filters) {
    const args = ['magick', inputPath];

    // Apply blur (works on original pixels)
    // CSS blur(Npx) ≈ ImageMagick -blur 0x(N*5) for visual match
    if (filters.blur > 0) {
        const sigma = filters.blur * 5;
        args.push('-blur', `0x${sigma}`);
    }

    // Apply exposure (affects overall brightness)
    if (filters.exposure !== 0) {
        const exposureMult = 1 + filters.exposure / 100;
        args.push('-evaluate', 'Multiply', `${exposureMult}`);
    }

    // Apply modulate for brightness, saturation, and hue rotation
    let brightnessPercent = filters.brightness;
    const saturationPercent = filters.saturation;
    let huePercent = 100;

    // Apply hue rotation (modulate hue component)
    if (filters.hueRotate !== 0) {
        // ImageMagick hue is 0-200, CSS is 0-360
        huePercent = 100 + (filters.hueRotate / 360) * 200;
    }

    // Only add modulate if any of these changed
    if (
        brightnessPercent !== 100 ||
        saturationPercent !== 100 ||
        huePercent !== 100
    ) {
        args.push(
            '-modulate',
            `${brightnessPercent},${saturationPercent},${huePercent}`
        );
    }

    // Apply contrast using sigmoidal contrast
    if (filters.contrast !== 100) {
        const contrastFactor = filters.contrast / 100 - 1;
        if (contrastFactor > 0) {
            args.push('-sigmoidal-contrast', `${3 + contrastFactor * 7}x50%`);
        } else if (contrastFactor < 0) {
            args.push(
                '+sigmoidal-contrast',
                `${3 + Math.abs(contrastFactor) * 7}x50%`
            );
        }
    }

    // Apply sepia using color matrix
    // CSS sepia is more aggressive, so we need to boost the amount for ImageMagick
    if (filters.sepia > 0) {
        const amount = filters.sepia / 100;
        // Multiply by 1.5 to match CSS sepia intensity
        const boostedAmount = Math.min(amount * 1.5, 1.0);
        const s = boostedAmount;
        const sepiaMatrix = `${0.393 * s + (1 - s)} ${0.769 * s} ${0.189 * s} ${0.349 * s} ${0.686 * s + (1 - s)} ${0.168 * s} ${0.272 * s} ${0.534 * s} ${0.131 * s + (1 - s)}`;
        args.push('-color-matrix', sepiaMatrix);
    }

    // Apply invert
    if (filters.invert > 0 && filters.invert >= 50) {
        args.push('-negate');
    }

    // ===== EFFECTS FILTERS =====

    // Apply oil paint effect (artistic painterly look)
    if (filters.oilPaint > 0) {
        // Map 0-10 to reasonable oil paint radius (0-5)
        const radius = filters.oilPaint / 2;
        args.push('-paint', `${radius}`);
    }

    // Apply color tone (sepia + hue-rotate + saturate combination)
    if (filters.tone !== null && filters.toneAmount > 0) {
        const amount = filters.toneAmount;

        // Step 1: Convert to sepia
        const sepiaMatrix =
            '0.393 0.769 0.189 0.349 0.686 0.168 0.272 0.534 0.131';

        if (amount < 100) {
            // Partial sepia: blend original with sepia
            args.push('(', '+clone', '-color-matrix', sepiaMatrix, ')');
            args.push(
                '-compose',
                'blend',
                '-define',
                `compose:args=${amount}`,
                '-composite'
            );
        } else {
            // Full sepia
            args.push('-color-matrix', sepiaMatrix);
        }

        // Step 2: Hue rotate
        const sepiaHue = 38;
        const hueDiff = filters.tone - sepiaHue;
        const hueRadians = (hueDiff * Math.PI) / 180;
        const cosA = Math.cos(hueRadians);
        const sinA = Math.sin(hueRadians);

        const m00 = 0.213 + cosA * 0.787 - sinA * 0.213;
        const m01 = 0.715 - cosA * 0.715 - sinA * 0.715;
        const m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
        const m10 = 0.213 - cosA * 0.213 + sinA * 0.143;
        const m11 = 0.715 + cosA * 0.285 + sinA * 0.14;
        const m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
        const m20 = 0.213 - cosA * 0.213 - sinA * 0.787;
        const m21 = 0.715 - cosA * 0.715 + sinA * 0.715;
        const m22 = 0.072 + cosA * 0.928 + sinA * 0.072;

        args.push(
            '-color-matrix',
            `${m00} ${m01} ${m02} ${m10} ${m11} ${m12} ${m20} ${m21} ${m22}`
        );

        // Step 3: Saturate
        const satAmount = 100 + amount / 2;
        args.push('-modulate', `100,${satAmount},100`);
    }

    // ===== TIER 1 FILTERS =====

    // Apply sharpen
    if (filters.sharpen > 0) {
        // -sharpen radius x sigma
        // Map 0-100 to reasonable sharpening values
        const radius = 0;
        const sigma = filters.sharpen / 20; // 0-5 range
        args.push('-sharpen', `${radius}x${sigma}`);
    }

    // Apply grain/noise (subtle monochrome grain, preserves colors)
    if (filters.grain > 0) {
        // Create subtle monochrome grain overlay
        // Map 0-10 slider to very subtle intensity
        const attenuate = filters.grain * 0.3; // 0-3 range for very subtle effect

        // Clone image, add noise to luminance channel only
        args.push('(', '+clone');

        // Create grayscale noise
        args.push('-colorspace', 'Gray');
        args.push('-attenuate', `${attenuate}`);
        args.push('+noise', 'Gaussian');

        args.push(')');

        // Blend using screen mode at low opacity for subtle grain
        args.push('-compose', 'blend');
        args.push('-define', `compose:args=20`); // 20% opacity for subtlety
        args.push('-composite');
    }

    // Apply shadows adjustment (lift shadows)
    if (filters.shadows !== 0) {
        // Use -brightness-contrast with shadow-mask technique
        // Positive values lift shadows, negative crushes them
        const shadowAdj = filters.shadows / 2; // -50 to 50
        args.push('-brightness-contrast', `${shadowAdj}x0`);
    }

    // Apply highlights adjustment (recover highlights)
    if (filters.highlights !== 0) {
        // Use level adjustment to recover/blow highlights
        // Negative values recover (compress), positive blows out
        const highlightAdj = filters.highlights;
        const whitePoint = 100 - highlightAdj / 2; // 150% to 50%
        args.push('-level', `0%,${whitePoint}%`);
    }

    // Apply vignette (darken edges)
    if (filters.vignette > 0) {
        // Create a dark vignette using radial gradient overlay
        // Higher slider value = darker vignette
        const vignetteAmount = filters.vignette / 100; // 0-1

        // Create a radial gradient mask and multiply it with the image
        args.push('(', '+clone');
        args.push('-size', '%[fx:w]x%[fx:h]');
        args.push('radial-gradient:white-black');
        args.push('-evaluate', 'Pow', `${1 - vignetteAmount * 0.7}`); // Control darkness
        args.push(')');
        args.push('-compose', 'Multiply', '-composite');
    }

    // Apply tint/colorize (overlay a translucent color wash)
    if (filters.tint > 0) {
        // Use fill + colorize to tint the image
        args.push('-fill', filters.tintColor);
        args.push('-colorize', `${filters.tint}%`);
    }

    // Add compression to reduce file size
    // Detect output format based on file extension
    const isJpeg = outputPath.toLowerCase().endsWith('.jpg') ||
                   outputPath.toLowerCase().endsWith('.jpeg');

    if (isJpeg) {
        // JPEG quality: 95 for high quality output
        args.push('-quality', '95');
    } else {
        // PNG quality: 75 sets compression level
        args.push('-quality', '75');
    }

    // Strip metadata to reduce size
    args.push('-strip');

    args.push(outputPath);
    return args;
}

/**
 * Apply filters to an image using ImageMagick
 * @param {string} inputPath - Source image path
 * @param {string} outputPath - Destination path
 * @param {Object} filters - Filter values
 * @returns {Promise<string>} Resolved with output path on success
 */
export async function applyFiltersWithImageMagick(
    inputPath,
    outputPath,
    filters
) {
    const args = buildImageMagickCommand(inputPath, outputPath, filters);

    return new Promise((resolve, reject) => {
        try {
            const proc = Gio.Subprocess.new(
                args,
                Gio.SubprocessFlags.STDOUT_PIPE |
                    Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.wait_async(null, (source, result) => {
                try {
                    source.wait_finish(result);
                    const exitCode = source.get_exit_status();

                    if (exitCode !== 0) {
                        const stderr = source.get_stderr_pipe();
                        if (stderr) {
                            const stream = new Gio.DataInputStream({
                                base_stream: stderr,
                            });
                            const [line] = stream.read_line_utf8(null);
                            reject(new Error(`ImageMagick error: ${line}`));
                            return;
                        }
                        reject(new Error('ImageMagick failed'));
                        return;
                    }

                    resolve(outputPath);
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
 * Get the cache directory for processed wallpapers
 * Uses a unique timestamp-based filename to avoid pywal caching issues
 * @returns {string} Cache file path with unique name
 */
export function getProcessedWallpaperCachePath() {
    const cacheDir = GLib.build_filenamev([
        GLib.get_user_cache_dir(),
        'aether',
    ]);
    GLib.mkdir_with_parents(cacheDir, 0o755);

    // Use timestamp to create unique filename each time
    // This forces pywal to re-extract colors instead of using cache
    // Use JPEG format for smaller file size and faster processing
    const timestamp = Date.now();
    const filename = `processed-wallpaper-${timestamp}.jpg`;
    const outputPath = GLib.build_filenamev([cacheDir, filename]);

    return outputPath;
}
