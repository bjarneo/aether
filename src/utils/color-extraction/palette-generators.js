import {hslToHex} from '../color-utils.js';
import {
    ANSI_PALETTE_SIZE,
    ANSI_HUE_ARRAY,
    MONOCHROME_SATURATION_THRESHOLD,
    SUBTLE_PALETTE_SATURATION,
    MONOCHROME_SATURATION,
    MONOCHROME_COLOR8_SATURATION_FACTOR,
    VERY_DARK_BACKGROUND_THRESHOLD,
    VERY_LIGHT_BACKGROUND_THRESHOLD,
    MIN_LIGHTNESS_ON_DARK_BG,
    MAX_LIGHTNESS_ON_LIGHT_BG,
    ABSOLUTE_MIN_LIGHTNESS,
    OUTLIER_LIGHTNESS_THRESHOLD,
    BRIGHT_THEME_THRESHOLD,
} from './constants.js';
import {
    getColorHSL,
    isDarkColor,
    findBackgroundColor,
    findForegroundColor,
    findBestColorMatch,
    generateBrightVersion,
    adjustColorLightness,
    sortColorsByLightness,
} from './color-analysis.js';
import {createLogger} from '../logger.js';

const log = createLogger('PaletteGenerator');

/**
 * Palette generation functions for different color schemes
 *
 * @module color-extraction/palette-generators
 */

/**
 * Generates a vibrant chromatic palette from diverse colors
 * @param {string[]} dominantColors - Array of dominant colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 ANSI colors
 */
export function generateChromaticPalette(dominantColors, lightMode) {
    const background = findBackgroundColor(dominantColors, lightMode);
    const usedIndices = new Set([background.index]);

    const foreground = findForegroundColor(
        dominantColors,
        lightMode,
        usedIndices
    );
    usedIndices.add(foreground.index);

    const palette = new Array(ANSI_PALETTE_SIZE);
    palette[0] = background.color;
    palette[7] = foreground.color;

    // Find best matches for ANSI colors 1-6
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const matchIndex = findBestColorMatch(
            ANSI_HUE_ARRAY[i],
            dominantColors,
            usedIndices
        );
        palette[i + 1] = dominantColors[matchIndex];
        usedIndices.add(matchIndex);
    }

    // Generate color8 (bright black/gray)
    const bgHsl = getColorHSL(background.color);
    const color8Lightness = isDarkColor(background.color)
        ? Math.min(100, bgHsl.l + 45)
        : Math.max(0, bgHsl.l - 40);
    palette[8] = hslToHex(bgHsl.h, bgHsl.s * 0.5, color8Lightness);

    // Generate bright versions (9-14) of colors 1-6
    for (let i = 1; i <= 6; i++) {
        palette[i + 8] = generateBrightVersion(palette[i]);
    }

    // Generate color15 (bright white)
    palette[15] = generateBrightVersion(foreground.color);

    return palette;
}

/**
 * Generates a subtle, balanced chromatic palette for low-diversity images
 * @param {string[]} dominantColors - Array of dominant colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 ANSI colors with balanced saturation
 */
export function generateSubtleBalancedPalette(dominantColors, lightMode) {
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    // Calculate average hue from chromatic colors
    const chromaticColors = dominantColors.filter(
        c => getColorHSL(c).s > MONOCHROME_SATURATION_THRESHOLD
    );
    const avgHue =
        chromaticColors.length > 0
            ? chromaticColors.reduce((sum, c) => sum + getColorHSL(c).h, 0) /
              chromaticColors.length
            : darkest.hue;

    const palette = new Array(ANSI_PALETTE_SIZE);

    // Set background and foreground
    palette[0] = lightMode ? lightest.color : darkest.color;
    palette[7] = lightMode ? darkest.color : lightest.color;

    // Generate ANSI colors 1-6 with balanced subtle saturation
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const lightness = 50 + (i - 2.5) * 4;
        palette[i + 1] = hslToHex(
            ANSI_HUE_ARRAY[i],
            SUBTLE_PALETTE_SATURATION,
            lightness
        );
    }

    // Color 8: gray for comments
    const color8Lightness = lightMode
        ? Math.max(0, lightest.lightness - 40)
        : Math.min(100, darkest.lightness + 45);
    palette[8] = hslToHex(
        avgHue,
        SUBTLE_PALETTE_SATURATION * 0.5,
        color8Lightness
    );

    // Colors 9-14: Slightly more saturated versions of 1-6
    const brightSaturation = SUBTLE_PALETTE_SATURATION + 8;
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const baseLightness = 50 + (i - 2.5) * 4;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(
            0,
            Math.min(100, baseLightness + adjustment)
        );
        palette[i + 9] = hslToHex(
            ANSI_HUE_ARRAY[i],
            brightSaturation,
            lightness
        );
    }

    // Color 15: Bright foreground
    palette[15] = lightMode
        ? hslToHex(
              avgHue,
              SUBTLE_PALETTE_SATURATION * 0.3,
              Math.max(0, darkest.lightness - 5)
          )
        : hslToHex(
              avgHue,
              SUBTLE_PALETTE_SATURATION * 0.3,
              Math.min(100, lightest.lightness + 5)
          );

    return palette;
}

/**
 * Generates a monochrome/grayscale ANSI palette
 * @param {string[]} grayColors - Array of grayscale colors
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 monochrome ANSI colors
 */
export function generateMonochromePalette(grayColors, lightMode) {
    const sortedByLightness = sortColorsByLightness(grayColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];
    const baseHue = darkest.hue;

    const palette = new Array(ANSI_PALETTE_SIZE);

    palette[0] = lightMode ? lightest.color : darkest.color;
    palette[7] = lightMode ? darkest.color : lightest.color;

    // Generate grayscale shades for ANSI colors 1-6
    if (lightMode) {
        const startL = darkest.lightness + 10;
        const endL = Math.min(darkest.lightness + 40, lightest.lightness - 10);
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
        }
    } else {
        const startL = Math.max(
            darkest.lightness + 30,
            lightest.lightness - 40
        );
        const endL = lightest.lightness - 10;
        const step = (endL - startL) / 5;

        for (let i = 1; i <= 6; i++) {
            const lightness = startL + (i - 1) * step;
            palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
        }
    }

    // Color 8: gray for comments
    const color8Lightness = lightMode
        ? Math.max(0, darkest.lightness + 5)
        : Math.min(100, lightest.lightness - 10);
    palette[8] = hslToHex(
        baseHue,
        MONOCHROME_SATURATION * MONOCHROME_COLOR8_SATURATION_FACTOR,
        color8Lightness
    );

    // Colors 9-14: Slightly lighter/darker versions of 1-6
    for (let i = 1; i <= 6; i++) {
        const hsl = getColorHSL(palette[i]);
        const adjustment = lightMode ? -10 : 10;
        const newL = Math.max(0, Math.min(100, hsl.l + adjustment));
        palette[i + 8] = hslToHex(baseHue, MONOCHROME_SATURATION, newL);
    }

    // Color 15: Bright white/black
    palette[15] = lightMode
        ? hslToHex(baseHue, 2, Math.max(0, darkest.lightness - 5))
        : hslToHex(baseHue, 2, Math.min(100, lightest.lightness + 5));

    return palette;
}

/**
 * Generates a monochromatic ANSI palette based on dominant hue from image
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 monochromatic ANSI colors
 */
export function generateMonochromaticPalette(dominantColors, lightMode) {
    // Find the most frequent color with good saturation
    let baseColor = null;

    for (const color of dominantColors) {
        const hsl = getColorHSL(color);
        if (hsl.s > MONOCHROME_SATURATION_THRESHOLD) {
            baseColor = {color, hsl};
            break;
        }
    }

    if (!baseColor) {
        baseColor = {
            color: dominantColors[0],
            hsl: getColorHSL(dominantColors[0]),
        };
    }

    const baseHue = baseColor.hsl.h;
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    const palette = new Array(ANSI_PALETTE_SIZE);

    if (lightMode) {
        palette[0] = hslToHex(baseHue, 8, Math.max(85, lightest.lightness));
        palette[7] = hslToHex(
            baseHue,
            25,
            Math.min(30, darkest.lightness + 10)
        );
    } else {
        palette[0] = hslToHex(baseHue, 15, Math.min(15, darkest.lightness));
        palette[7] = hslToHex(
            baseHue,
            10,
            Math.max(80, lightest.lightness - 10)
        );
    }

    const saturationLevels = [40, 50, 45, 55, 42, 48];
    const lightnessBase = lightMode ? 45 : 55;

    for (let i = 0; i < 6; i++) {
        const lightness = lightnessBase + (i - 2.5) * 5;
        palette[i + 1] = hslToHex(baseHue, saturationLevels[i], lightness);
    }

    palette[8] = hslToHex(baseHue, 20, lightMode ? 40 : 65);

    const brightSaturationLevels = [60, 70, 65, 75, 62, 68];
    for (let i = 0; i < 6; i++) {
        const baseLightness = lightnessBase + (i - 2.5) * 5;
        const adjustment = lightMode ? -8 : 8;
        const lightness = Math.max(
            0,
            Math.min(100, baseLightness + adjustment)
        );
        palette[i + 9] = hslToHex(
            baseHue,
            brightSaturationLevels[i],
            lightness
        );
    }

    if (lightMode) {
        palette[15] = hslToHex(
            baseHue,
            30,
            Math.min(25, darkest.lightness + 5)
        );
    } else {
        palette[15] = hslToHex(baseHue, 15, Math.max(85, lightest.lightness));
    }

    return palette;
}

/**
 * Helper to transform a chromatic palette with custom color rules
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @param {Object} rules - Transformation rules for different color indices
 * @returns {string[]} Transformed palette
 * @private
 */
function transformChromaticPalette(dominantColors, lightMode, rules) {
    const palette = generateChromaticPalette(dominantColors, lightMode);

    return palette.map((color, index) => {
        const hsl = getColorHSL(color);
        const rule = rules[index] || rules.default;
        return lightMode ? rule.light(hsl) : rule.dark(hsl);
    });
}

/**
 * Generates a pastel color palette (low saturation, high lightness)
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 pastel ANSI colors
 */
export function generatePastelPalette(dominantColors, lightMode) {
    return transformChromaticPalette(dominantColors, lightMode, {
        0: {
            light: hsl => hslToHex(hsl.h, 10, 95),
            dark: hsl => hslToHex(hsl.h, 15, 20),
        },
        7: {
            light: hsl => hslToHex(hsl.h, 25, 35),
            dark: hsl => hslToHex(hsl.h, 20, 75),
        },
        15: {
            light: hsl => hslToHex(hsl.h, 25, 35),
            dark: hsl => hslToHex(hsl.h, 20, 75),
        },
        8: {
            light: hsl => hslToHex(hsl.h, 15, 65),
            dark: hsl => hslToHex(hsl.h, 12, 45),
        },
        default: {
            light: hsl => hslToHex(hsl.h, Math.min(35, hsl.s), 50),
            dark: hsl => hslToHex(hsl.h, Math.min(35, hsl.s), 70),
        },
    });
}

/**
 * Generates a highly saturated, vibrant colorful palette
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 colorful ANSI colors
 */
export function generateColorfulPalette(dominantColors, lightMode) {
    return transformChromaticPalette(dominantColors, lightMode, {
        0: {
            light: hsl => hslToHex(hsl.h, 8, 98),
            dark: hsl => hslToHex(hsl.h, 12, 8),
        },
        7: {
            light: hsl => hslToHex(hsl.h, 15, 10),
            dark: hsl => hslToHex(hsl.h, 10, 95),
        },
        15: {
            light: hsl => hslToHex(hsl.h, 15, 10),
            dark: hsl => hslToHex(hsl.h, 10, 95),
        },
        8: {
            light: hsl => hslToHex(hsl.h, 20, 50),
            dark: hsl => hslToHex(hsl.h, 15, 55),
        },
        default: {
            light: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(75, Math.min(95, hsl.s + 30)),
                    Math.max(35, Math.min(55, hsl.l))
                ),
            dark: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(75, Math.min(95, hsl.s + 30)),
                    Math.max(55, Math.min(70, hsl.l))
                ),
        },
    });
}

/**
 * Generates a desaturated, muted palette with subdued colors
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 muted ANSI colors
 */
export function generateMutedPalette(dominantColors, lightMode) {
    return transformChromaticPalette(dominantColors, lightMode, {
        0: {
            light: hsl => hslToHex(hsl.h, 5, 95),
            dark: hsl => hslToHex(hsl.h, 8, 15),
        },
        7: {
            light: hsl => hslToHex(hsl.h, 10, 20),
            dark: hsl => hslToHex(hsl.h, 8, 85),
        },
        15: {
            light: hsl => hslToHex(hsl.h, 10, 20),
            dark: hsl => hslToHex(hsl.h, 8, 85),
        },
        8: {
            light: hsl => hslToHex(hsl.h, 8, 60),
            dark: hsl => hslToHex(hsl.h, 6, 50),
        },
        default: {
            light: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(15, Math.min(35, hsl.s * 0.5)),
                    Math.max(40, Math.min(60, hsl.l))
                ),
            dark: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(15, Math.min(35, hsl.s * 0.5)),
                    Math.max(50, Math.min(65, hsl.l))
                ),
        },
    });
}

/**
 * Generates a high-lightness bright palette with punchy colors
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 bright ANSI colors
 */
export function generateBrightPalette(dominantColors, lightMode) {
    return transformChromaticPalette(dominantColors, lightMode, {
        0: {
            light: hsl => hslToHex(hsl.h, 6, 98),
            dark: hsl => hslToHex(hsl.h, 10, 6),
        },
        7: {
            light: hsl => hslToHex(hsl.h, 12, 15),
            dark: hsl => hslToHex(hsl.h, 8, 98),
        },
        15: {
            light: hsl => hslToHex(hsl.h, 12, 15),
            dark: hsl => hslToHex(hsl.h, 8, 98),
        },
        8: {
            light: hsl => hslToHex(hsl.h, 15, 55),
            dark: hsl => hslToHex(hsl.h, 12, 65),
        },
        default: {
            light: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(45, Math.min(70, hsl.s)),
                    Math.max(45, Math.min(65, hsl.l + 10))
                ),
            dark: hsl =>
                hslToHex(
                    hsl.h,
                    Math.max(45, Math.min(70, hsl.s)),
                    Math.max(65, Math.min(80, hsl.l + 15))
                ),
        },
    });
}

/**
 * Generates a Material Design-inspired palette
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 Material Design ANSI colors
 */
export function generateMaterialPalette(dominantColors, lightMode) {
    const palette = new Array(ANSI_PALETTE_SIZE);
    const usedIndices = new Set();

    // Material backgrounds
    if (lightMode) {
        palette[0] = '#fafafa';
        palette[7] = '#212121';
    } else {
        palette[0] = '#121212';
        palette[7] = '#ffffff';
    }

    // Find best ANSI color matches from actual image colors
    for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
        const matchIndex = findBestColorMatch(
            ANSI_HUE_ARRAY[i],
            dominantColors,
            usedIndices
        );
        const matchedColor = dominantColors[matchIndex];
        const hsl = getColorHSL(matchedColor);

        const refinedSaturation = Math.max(hsl.s, 35);
        const refinedLightness = lightMode
            ? Math.max(35, Math.min(60, hsl.l))
            : Math.max(45, Math.min(70, hsl.l));

        palette[i + 1] = hslToHex(hsl.h, refinedSaturation, refinedLightness);
        usedIndices.add(matchIndex);
    }

    palette[8] = lightMode ? '#757575' : '#9e9e9e';

    for (let i = 1; i <= 6; i++) {
        const hsl = getColorHSL(palette[i]);
        const brightSaturation = Math.min(100, hsl.s + 8);
        const brightLightness = lightMode
            ? Math.max(30, hsl.l - 8)
            : Math.min(75, hsl.l + 8);

        palette[i + 8] = hslToHex(hsl.h, brightSaturation, brightLightness);
    }

    palette[15] = lightMode ? '#000000' : '#ffffff';

    return palette;
}

/**
 * Generates an analogous color palette (adjacent hues on the color wheel)
 * @param {string[]} dominantColors - Array of dominant colors from image
 * @param {boolean} lightMode - Whether to generate light mode palette
 * @returns {string[]} Array of 16 analogous ANSI colors
 */
export function generateAnalogousPalette(dominantColors, lightMode) {
    const chromaticColors = dominantColors
        .map(color => {
            const hsl = getColorHSL(color);
            return {color, hsl, saturation: hsl.s};
        })
        .filter(c => c.saturation > MONOCHROME_SATURATION_THRESHOLD)
        .sort((a, b) => b.saturation - a.saturation);

    const baseColor =
        chromaticColors.length > 0
            ? chromaticColors[0]
            : {color: dominantColors[0], hsl: getColorHSL(dominantColors[0])};

    const baseHue = baseColor.hsl.h;
    const sortedByLightness = sortColorsByLightness(dominantColors);
    const darkest = sortedByLightness[0];
    const lightest = sortedByLightness[sortedByLightness.length - 1];

    const palette = new Array(ANSI_PALETTE_SIZE);

    if (lightMode) {
        palette[0] = hslToHex(baseHue, 12, Math.max(90, lightest.lightness));
        palette[7] = hslToHex(
            baseHue,
            30,
            Math.min(25, darkest.lightness + 10)
        );
    } else {
        palette[0] = hslToHex(baseHue, 18, Math.min(12, darkest.lightness));
        palette[7] = hslToHex(
            baseHue,
            15,
            Math.max(85, lightest.lightness - 10)
        );
    }

    const analogousOffsets = [-30, -20, -10, 10, 20, 30];
    const saturationLevels = [45, 50, 48, 52, 47, 50];
    const lightnessBase = lightMode ? 45 : 58;

    for (let i = 0; i < 6; i++) {
        const hue = (baseHue + analogousOffsets[i] + 360) % 360;
        const lightness = lightnessBase + (i % 2 === 0 ? -3 : 3);
        palette[i + 1] = hslToHex(hue, saturationLevels[i], lightness);
    }

    palette[8] = lightMode
        ? hslToHex(baseHue, 20, 55)
        : hslToHex(baseHue, 15, 45);

    for (let i = 0; i < 6; i++) {
        const hue = (baseHue + analogousOffsets[i] + 360) % 360;
        const lightness = lightMode ? 38 : 68;
        palette[i + 9] = hslToHex(hue, saturationLevels[i] + 8, lightness);
    }

    palette[15] = lightMode
        ? hslToHex(baseHue, 20, 20)
        : hslToHex(baseHue, 10, 95);

    return palette;
}

/**
 * Normalizes brightness of ANSI colors to ensure readability
 * @param {string[]} palette - Palette with colors 0-15
 * @returns {string[]} Normalized palette
 */
export function normalizeBrightness(palette) {
    const bgHsl = getColorHSL(palette[0]);
    const bgLightness = bgHsl.l;

    const isVeryDarkBg = bgLightness < VERY_DARK_BACKGROUND_THRESHOLD;
    const isVeryLightBg = bgLightness > VERY_LIGHT_BACKGROUND_THRESHOLD;

    const colorIndices = [1, 2, 3, 4, 5, 6, 7];
    const ansiColors = colorIndices.map(i => {
        const hsl = getColorHSL(palette[i]);
        return {index: i, lightness: hsl.l, hue: hsl.h, saturation: hsl.s};
    });

    const avgLightness =
        ansiColors.reduce((sum, c) => sum + c.lightness, 0) / ansiColors.length;
    const isBrightTheme = avgLightness > BRIGHT_THEME_THRESHOLD;

    if (isVeryDarkBg) {
        ansiColors.forEach(colorInfo => {
            if (colorInfo.lightness < MIN_LIGHTNESS_ON_DARK_BG) {
                const adjustedLightness =
                    MIN_LIGHTNESS_ON_DARK_BG + colorInfo.index * 3;
                log.debug(
                    `Adjusting color ${colorInfo.index} for dark bg: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
                );
                palette[colorInfo.index] = adjustColorLightness(
                    palette[colorInfo.index],
                    adjustedLightness
                );
                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    palette[colorInfo.index + 8] = generateBrightVersion(
                        palette[colorInfo.index]
                    );
                }
            }
        });
        return palette;
    }

    if (isVeryLightBg) {
        ansiColors.forEach(colorInfo => {
            if (colorInfo.lightness > MAX_LIGHTNESS_ON_LIGHT_BG) {
                const adjustedLightness = Math.max(
                    ABSOLUTE_MIN_LIGHTNESS,
                    MAX_LIGHTNESS_ON_LIGHT_BG - colorInfo.index * 2
                );
                log.debug(
                    `Adjusting color ${colorInfo.index} for light bg: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
                );
                palette[colorInfo.index] = adjustColorLightness(
                    palette[colorInfo.index],
                    adjustedLightness
                );
                if (colorInfo.index >= 1 && colorInfo.index <= 6) {
                    palette[colorInfo.index + 8] = generateBrightVersion(
                        palette[colorInfo.index]
                    );
                }
            }
        });
        return palette;
    }

    // Normal background - apply outlier detection
    const outliers = ansiColors.filter(
        c => Math.abs(c.lightness - avgLightness) > OUTLIER_LIGHTNESS_THRESHOLD
    );

    outliers.forEach(outlier => {
        const isDarkOutlierInBrightTheme =
            isBrightTheme &&
            outlier.lightness < avgLightness - OUTLIER_LIGHTNESS_THRESHOLD;
        const isBrightOutlierInDarkTheme =
            !isBrightTheme &&
            outlier.lightness > avgLightness + OUTLIER_LIGHTNESS_THRESHOLD;

        if (isDarkOutlierInBrightTheme || isBrightOutlierInDarkTheme) {
            const adjustedLightness = isDarkOutlierInBrightTheme
                ? avgLightness - 10
                : avgLightness + 10;
            log.debug(
                `Adjusting outlier color ${outlier.index}: ${outlier.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`
            );
            palette[outlier.index] = adjustColorLightness(
                palette[outlier.index],
                adjustedLightness
            );
            if (outlier.index >= 1 && outlier.index <= 6) {
                palette[outlier.index + 8] = generateBrightVersion(
                    palette[outlier.index]
                );
            }
        }
    });

    return palette;
}
