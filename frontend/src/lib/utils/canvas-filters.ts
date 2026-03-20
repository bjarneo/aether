/**
 * Pure pixel manipulation filters — no CSS filter API.
 * Works in all webkit2gtk versions.
 */

export interface Filters {
    blur: number;
    brightness: number;
    contrast: number;
    saturation: number;
    hueRotate: number;
    sepia: number;
    invert: number;
    exposure: number;
    vignette: number;
    sharpen: number;
    grain: number;
    oilPaint: number;
    pixelate: number;
    shadows: number;
    highlights: number;
    temperature: number; // -100 (cool) to 100 (warm)
    tint: number; // -100 (green) to 100 (magenta)
    fade: number; // 0-100 (lift blacks)
    clarity: number; // 0-100 (local contrast)
    posterize: number; // 0-10 (color levels, 0=off)
    noise: number; // 0-100 (color noise, not mono)
}

export const DEFAULT_FILTERS: Filters = {
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hueRotate: 0,
    sepia: 0,
    invert: 0,
    exposure: 0,
    vignette: 0,
    sharpen: 0,
    grain: 0,
    oilPaint: 0,
    pixelate: 0,
    shadows: 0,
    highlights: 0,
    temperature: 0,
    tint: 0,
    fade: 0,
    clarity: 0,
    posterize: 0,
    noise: 0,
};

export function applyFilters(
    img: HTMLImageElement,
    filters: Filters,
    maxSize = 0
): string {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) return '';

    if (maxSize > 0 && (w > maxSize || h > maxSize)) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(img, 0, 0, w, h);

    // Pixelate (re-sample)
    if (filters.pixelate > 0) {
        const block = Math.max(2, Math.round(filters.pixelate / 5));
        const sw = Math.max(1, Math.round(w / block));
        const sh = Math.max(1, Math.round(h / block));
        const tmp = document.createElement('canvas');
        tmp.width = sw;
        tmp.height = sh;
        tmp.getContext('2d')!.drawImage(canvas, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    // Blur (two-pass box blur)
    if (filters.blur > 0) {
        boxBlur(ctx, w, h, Math.max(1, Math.round(filters.blur / 10)));
    }

    // Oil paint (heavier box blur)
    if (filters.oilPaint > 0) {
        boxBlur(ctx, w, h, Math.max(2, Math.round(filters.oilPaint * 2)));
    }

    // Single-pass per-pixel adjustments
    const needsPixel =
        filters.brightness !== 100 ||
        filters.contrast !== 100 ||
        filters.saturation !== 100 ||
        filters.hueRotate !== 0 ||
        filters.sepia > 0 ||
        filters.invert > 0 ||
        filters.exposure !== 0 ||
        filters.shadows !== 0 ||
        filters.highlights !== 0 ||
        filters.grain > 0 ||
        filters.temperature !== 0 ||
        filters.tint !== 0 ||
        filters.fade > 0 ||
        filters.noise > 0 ||
        filters.posterize > 0;

    if (needsPixel) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;

        const bri = filters.brightness / 100;
        const conFactor = filters.contrast / 100;
        const sat = filters.saturation / 100;
        const sepiaAmt = filters.sepia / 100;
        const invertAmt = filters.invert / 100;
        const gamma =
            filters.exposure !== 0
                ? filters.exposure > 0
                    ? 1 / (1 + filters.exposure / 100)
                    : 1 + Math.abs(filters.exposure) / 100
                : 1;
        const shadowAdj = filters.shadows / 200;
        const highlightAdj = filters.highlights / 200;
        const grainInt = filters.grain * 8;
        const tempWarm = filters.temperature / 100; // -1 to 1
        const tintShift = filters.tint / 100; // -1 to 1
        const fadeAmt = filters.fade / 100; // 0 to 1
        const noiseInt = filters.noise * 2.5;
        const posterLevels =
            filters.posterize > 0
                ? Math.max(2, Math.round(11 - filters.posterize))
                : 0;
        const hueRad = (filters.hueRotate * Math.PI) / 180;
        const cosH = Math.cos(hueRad);
        const sinH = Math.sin(hueRad);

        for (let i = 0; i < d.length; i += 4) {
            let r = d[i],
                g = d[i + 1],
                b = d[i + 2];

            // Invert
            if (invertAmt > 0) {
                r = r + (255 - 2 * r) * invertAmt;
                g = g + (255 - 2 * g) * invertAmt;
                b = b + (255 - 2 * b) * invertAmt;
            }

            // Brightness
            r *= bri;
            g *= bri;
            b *= bri;

            // Contrast
            r = 128 + (r - 128) * conFactor;
            g = 128 + (g - 128) * conFactor;
            b = 128 + (b - 128) * conFactor;

            // Saturation
            if (sat !== 1) {
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = gray + (r - gray) * sat;
                g = gray + (g - gray) * sat;
                b = gray + (b - gray) * sat;
            }

            // Hue rotate
            if (filters.hueRotate !== 0) {
                const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const u = -0.09991 * r - 0.33609 * g + 0.436 * b;
                const v = 0.615 * r - 0.55861 * g - 0.05639 * b;
                const u2 = u * cosH - v * sinH;
                const v2 = u * sinH + v * cosH;
                r = l + 1.28033 * v2;
                g = l - 0.21482 * u2 - 0.38059 * v2;
                b = l + 2.12798 * u2;
            }

            // Sepia
            if (sepiaAmt > 0) {
                const sr = 0.393 * r + 0.769 * g + 0.189 * b;
                const sg = 0.349 * r + 0.686 * g + 0.168 * b;
                const sb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = r + (sr - r) * sepiaAmt;
                g = g + (sg - g) * sepiaAmt;
                b = b + (sb - b) * sepiaAmt;
            }

            // Exposure (gamma)
            if (gamma !== 1) {
                r = Math.pow(Math.max(0, r) / 255, gamma) * 255;
                g = Math.pow(Math.max(0, g) / 255, gamma) * 255;
                b = Math.pow(Math.max(0, b) / 255, gamma) * 255;
            }

            // Shadows (dark tones)
            if (shadowAdj !== 0) {
                const rv = r / 255,
                    gv = g / 255,
                    bv = b / 255;
                if (rv < 0.5) r = (rv + shadowAdj * (1 - rv / 0.5)) * 255;
                if (gv < 0.5) g = (gv + shadowAdj * (1 - gv / 0.5)) * 255;
                if (bv < 0.5) b = (bv + shadowAdj * (1 - bv / 0.5)) * 255;
            }

            // Highlights (bright tones)
            if (highlightAdj !== 0) {
                const rv = r / 255,
                    gv = g / 255,
                    bv = b / 255;
                if (rv > 0.5)
                    r = (rv + highlightAdj * ((rv - 0.5) / 0.5)) * 255;
                if (gv > 0.5)
                    g = (gv + highlightAdj * ((gv - 0.5) / 0.5)) * 255;
                if (bv > 0.5)
                    b = (bv + highlightAdj * ((bv - 0.5) / 0.5)) * 255;
            }

            // Temperature (warm = boost red, cool = boost blue)
            if (tempWarm !== 0) {
                r += tempWarm * 30;
                b -= tempWarm * 30;
            }

            // Tint (positive = magenta/boost red+blue, negative = green/boost green)
            if (tintShift !== 0) {
                g -= tintShift * 20;
                r += tintShift * 10;
                b += tintShift * 10;
            }

            // Fade (lift blacks — add to all channels, more effect on darks)
            if (fadeAmt > 0) {
                const lift = fadeAmt * 60;
                r += lift * (1 - r / 255);
                g += lift * (1 - g / 255);
                b += lift * (1 - b / 255);
            }

            // Posterize (reduce color levels)
            if (posterLevels > 0) {
                const step = 255 / (posterLevels - 1);
                r = Math.round(r / step) * step;
                g = Math.round(g / step) * step;
                b = Math.round(b / step) * step;
            }

            // Grain (monochrome noise)
            if (grainInt > 0) {
                const noise = (Math.random() - 0.5) * grainInt;
                r += noise;
                g += noise;
                b += noise;
            }

            // Color noise (per-channel random)
            if (noiseInt > 0) {
                r += (Math.random() - 0.5) * noiseInt;
                g += (Math.random() - 0.5) * noiseInt;
                b += (Math.random() - 0.5) * noiseInt;
            }

            d[i] = Math.max(0, Math.min(255, r));
            d[i + 1] = Math.max(0, Math.min(255, g));
            d[i + 2] = Math.max(0, Math.min(255, b));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Sharpen (convolution kernel)
    if (filters.sharpen > 0) {
        const amount = filters.sharpen / 100;
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const src = new Uint8ClampedArray(d);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;
                for (let c = 0; c < 3; c++) {
                    const center = src[idx + c] * 5;
                    const n =
                        src[((y - 1) * w + x) * 4 + c] +
                        src[((y + 1) * w + x) * 4 + c] +
                        src[(y * w + x - 1) * 4 + c] +
                        src[(y * w + x + 1) * 4 + c];
                    d[idx + c] = Math.max(
                        0,
                        Math.min(
                            255,
                            src[idx + c] + (center - n) * amount * 0.25
                        )
                    );
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Clarity (local contrast — unsharp mask with large radius)
    if (filters.clarity > 0) {
        const amount = filters.clarity / 100;
        // Create blurred copy
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = w;
        blurCanvas.height = h;
        const blurCtx = blurCanvas.getContext('2d', {
            willReadFrequently: true,
        })!;
        blurCtx.drawImage(canvas, 0, 0);
        boxBlur(blurCtx, w, h, Math.max(3, Math.round(w / 80)));

        const sharp = ctx.getImageData(0, 0, w, h);
        const blurred = blurCtx.getImageData(0, 0, w, h);
        const sd = sharp.data,
            bd = blurred.data;

        for (let i = 0; i < sd.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const diff = sd[i + c] - bd[i + c];
                sd[i + c] = Math.max(
                    0,
                    Math.min(255, sd[i + c] + diff * amount)
                );
            }
        }
        ctx.putImageData(sharp, 0, 0);
    }

    // Vignette
    if (filters.vignette > 0) {
        const strength = filters.vignette / 100;
        const cx = w / 2,
            cy = h / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy);
        const grad = ctx.createRadialGradient(
            cx,
            cy,
            maxR * 0.3,
            cx,
            cy,
            maxR * 0.85
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${strength * 0.8})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    return canvas.toDataURL('image/jpeg', 0.92);
}

function boxBlur(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    radius: number
) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imageData.data);
    const dst = imageData.data;

    // Horizontal
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rS = 0,
                gS = 0,
                bS = 0,
                cnt = 0;
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = Math.min(w - 1, Math.max(0, x + dx));
                const j = (y * w + nx) * 4;
                rS += src[j];
                gS += src[j + 1];
                bS += src[j + 2];
                cnt++;
            }
            const j = (y * w + x) * 4;
            dst[j] = rS / cnt;
            dst[j + 1] = gS / cnt;
            dst[j + 2] = bS / cnt;
        }
    }

    const mid = new Uint8ClampedArray(dst);

    // Vertical
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rS = 0,
                gS = 0,
                bS = 0,
                cnt = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                const ny = Math.min(h - 1, Math.max(0, y + dy));
                const j = (ny * w + x) * 4;
                rS += mid[j];
                gS += mid[j + 1];
                bS += mid[j + 2];
                cnt++;
            }
            const j = (y * w + x) * 4;
            dst[j] = rS / cnt;
            dst[j + 1] = gS / cnt;
            dst[j + 2] = bS / cnt;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

export function hasActiveFilters(f: Filters): boolean {
    return (
        f.blur !== 0 ||
        f.brightness !== 100 ||
        f.contrast !== 100 ||
        f.saturation !== 100 ||
        f.hueRotate !== 0 ||
        f.sepia !== 0 ||
        f.invert !== 0 ||
        f.exposure !== 0 ||
        f.vignette !== 0 ||
        f.sharpen !== 0 ||
        f.grain !== 0 ||
        f.oilPaint !== 0 ||
        f.pixelate !== 0 ||
        f.shadows !== 0 ||
        f.highlights !== 0 ||
        f.temperature !== 0 ||
        f.tint !== 0 ||
        f.fade > 0 ||
        f.clarity > 0 ||
        f.posterize > 0 ||
        f.noise > 0
    );
}
