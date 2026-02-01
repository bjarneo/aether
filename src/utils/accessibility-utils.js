/**
 * Accessibility utility functions for color contrast and color blindness simulation
 */

import {hexToRgb} from './color-utils.js';

/**
 * Calculate relative luminance of a color
 * @param {string} hexColor - Hex color string
 * @returns {number} Relative luminance (0-1)
 */
export function getRelativeLuminance(hexColor) {
    const rgb = hexToRgb(hexColor);

    // Convert to sRGB
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    // Apply gamma correction (sRGB to linear)
    const r =
        rsRGB <= 0.04045
            ? rsRGB / 12.92
            : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g =
        gsRGB <= 0.04045
            ? gsRGB / 12.92
            : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b =
        bsRGB <= 0.04045
            ? bsRGB / 12.92
            : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @returns {number} Contrast ratio (1-21)
 */
export function getContrastRatio(color1, color2) {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG compliance level
 * @param {number} ratio - Contrast ratio
 * @param {boolean} largeText - Is the text large (18pt+ or 14pt+ bold)
 * @returns {Object} Compliance levels { aa: boolean, aaa: boolean }
 */
export function getWCAGCompliance(ratio, largeText = false) {
    const aaThreshold = largeText ? 3.0 : 4.5;
    const aaaThreshold = largeText ? 4.5 : 7.0;

    return {
        aa: ratio >= aaThreshold,
        aaa: ratio >= aaaThreshold,
        level:
            ratio >= aaaThreshold
                ? 'AAA'
                : ratio >= aaThreshold
                  ? 'AA'
                  : 'Fail',
    };
}

/**
 * Convert sRGB to linear RGB (gamma expansion)
 * @param {number} c - sRGB color component (0-1)
 * @returns {number} Linear RGB component (0-1)
 */
function sRGBtoLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB to sRGB (gamma compression)
 * @param {number} c - Linear RGB component (0-1)
 * @returns {number} sRGB component (0-1)
 */
function linearToSRGB(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Simulate color blindness
 * @param {string} hexColor - Hex color string
 * @param {string} type - Type of color blindness (protanopia, deuteranopia, tritanopia)
 * @returns {string} Simulated hex color
 */
export function simulateColorBlindness(hexColor, type) {
    const rgb = hexToRgb(hexColor);
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    // Convert sRGB to linear RGB for accurate transformation
    r = sRGBtoLinear(r);
    g = sRGBtoLinear(g);
    b = sRGBtoLinear(b);

    // Transformation matrices for different types of color blindness
    // Based on Viénot, Brettel & Mollon (1999)
    const matrices = {
        protanopia: [
            [0.567, 0.433, 0.0],
            [0.558, 0.442, 0.0],
            [0.0, 0.242, 0.758],
        ],
        deuteranopia: [
            [0.625, 0.375, 0.0],
            [0.7, 0.3, 0.0],
            [0.0, 0.3, 0.7],
        ],
        tritanopia: [
            [0.95, 0.05, 0.0],
            [0.0, 0.433, 0.567],
            [0.0, 0.475, 0.525],
        ],
    };

    const matrix = matrices[type] || matrices.protanopia;

    // Apply transformation in linear RGB space
    let newR = matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b;
    let newG = matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b;
    let newB = matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b;

    // Convert back to sRGB
    newR = linearToSRGB(newR);
    newG = linearToSRGB(newG);
    newB = linearToSRGB(newB);

    // Clamp values and convert back to hex
    const rHex = Math.round(Math.max(0, Math.min(1, newR)) * 255)
        .toString(16)
        .padStart(2, '0');
    const gHex = Math.round(Math.max(0, Math.min(1, newG)) * 255)
        .toString(16)
        .padStart(2, '0');
    const bHex = Math.round(Math.max(0, Math.min(1, newB)) * 255)
        .toString(16)
        .padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}

/**
 * Get readability score for a color pair
 * @param {string} foreground - Foreground hex color
 * @param {string} background - Background hex color
 * @returns {Object} Readability information
 */
export function getReadabilityScore(foreground, background) {
    const ratio = getContrastRatio(foreground, background);
    const normalText = getWCAGCompliance(ratio, false);
    const largeText = getWCAGCompliance(ratio, true);

    let score = 0;
    if (ratio >= 7) score = 5;
    else if (ratio >= 4.5) score = 4;
    else if (ratio >= 3) score = 3;
    else if (ratio >= 2) score = 2;
    else score = 1;

    return {
        ratio: ratio.toFixed(2),
        score,
        normalText,
        largeText,
        recommendation:
            score >= 4
                ? 'Excellent'
                : score >= 3
                  ? 'Good'
                  : score >= 2
                    ? 'Poor'
                    : 'Very Poor',
    };
}
