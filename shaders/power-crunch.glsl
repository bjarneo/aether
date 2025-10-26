// POWER CRUNCH - Screen compression and crushing effect
// Use with: hyprshade on power-crunch
// Sharp, jarring crunch with compression - like Vercel Hyper terminal crunch mode

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Fast hash
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash2d(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Step noise - for sharp, jarring movements
float stepNoise(float x) {
    return hash(floor(x));
}

vec2 stepNoise2d(float x) {
    float n = floor(x);
    return vec2(hash(n), hash(n + 1.0));
}

// CRUNCH: Horizontal compression with sharp snaps
vec2 horizontalCrunch(vec2 uv, float time) {
    float crunchSpeed = 25.0; // Slower
    float crunchFreq = 8.0;

    // Divide screen into horizontal bands
    float band = floor(uv.y * crunchFreq);
    float bandTime = time * crunchSpeed + band * 0.3;

    // Each band compresses/stretches independently with SHARP transitions
    float compression = stepNoise(bandTime);
    compression = (compression - 0.5) * 0.04; // Much subtler

    // Compress from center of each band
    float bandCenter = (band + 0.5) / crunchFreq;
    uv.x = mix(uv.x, bandCenter + (uv.x - bandCenter) * (1.0 + compression), 0.3);

    return uv;
}

// CRUNCH: Vertical squeeze with sharp jolts
vec2 verticalCrunch(vec2 uv, float time) {
    float crunchSpeed = 30.0; // Slower
    float crunchFreq = 6.0;

    // Divide screen into vertical bands
    float band = floor(uv.x * crunchFreq);
    float bandTime = time * crunchSpeed + band * 0.4;

    // Sharp compression
    float compression = stepNoise(bandTime);
    compression = (compression - 0.5) * 0.035; // Much subtler

    float bandCenter = (band + 0.5) / crunchFreq;
    uv.y = mix(uv.y, bandCenter + (uv.y - bandCenter) * (1.0 + compression), 0.25);

    return uv;
}

// CRUNCH: Random block displacement - sharp and jarring
vec2 blockCrunch(vec2 uv, float time) {
    float blockSize = 20.0; // Bigger blocks
    float crunchSpeed = 20.0; // Slower

    vec2 blockId = floor(uv * blockSize);
    float blockTime = floor(time * crunchSpeed);

    // Random chance for each block to crunch
    float shouldCrunch = step(0.93, hash2d(blockId + blockTime)); // Less frequent

    if (shouldCrunch > 0.0) {
        vec2 offset = vec2(
            hash2d(blockId + vec2(blockTime, 0.0)) - 0.5,
            hash2d(blockId + vec2(0.0, blockTime)) - 0.5
        ) * 0.008; // Much smaller offset

        uv += offset;
    }

    return uv;
}

// CRUNCH: Screen squash - compress entire screen
vec2 screenSquash(vec2 uv, float time) {
    float squashSpeed = 15.0; // Much slower

    // Sharp squash pulses
    float squashX = stepNoise(time * squashSpeed) * 0.015; // Way subtler
    float squashY = stepNoise(time * squashSpeed + 10.0) * 0.015;

    vec2 center = vec2(0.5);
    vec2 delta = uv - center;

    // Compress toward center
    delta.x *= 1.0 + squashX;
    delta.y *= 1.0 + squashY;

    return center + delta;
}

// Sharp jitter shake - not smooth
vec2 jitterShake(float time) {
    float shakeSpeed = 40.0; // Much slower
    vec2 shake = stepNoise2d(time * shakeSpeed);
    shake = (shake - 0.5) * 0.004; // Much subtler

    return shake;
}

// Chromatic crunch - sharp RGB splits
vec4 crunchChromatic(vec2 uv, float time) {
    float splitSpeed = 20.0; // Slower

    // Sharp, changing splits
    float splitAmount = stepNoise(time * splitSpeed) * 0.004; // Much subtler
    vec2 splitDir = stepNoise2d(time * splitSpeed + 5.0);
    splitDir = normalize(splitDir - 0.5);

    vec4 color;
    color.r = texture(tex, clamp(uv + splitDir * splitAmount * 1.5, 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv - splitDir * splitAmount * 1.5, 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// Scan corruption - horizontal line glitches
vec2 scanCorruption(vec2 uv, float time) {
    float corruptSpeed = 15.0; // Slower
    float lineCount = 80.0;

    float line = floor(uv.y * lineCount);
    float lineTime = floor(time * corruptSpeed);

    // Random lines get offset
    float corrupt = step(0.95, hash2d(vec2(line, lineTime))); // Less frequent

    if (corrupt > 0.0) {
        float offset = (hash(line + lineTime) - 0.5) * 0.02; // Much smaller
        uv.x += offset;
    }

    return uv;
}

// Pixel crunch - sudden pixelation
vec2 pixelCrunch(vec2 uv, float time) {
    float crunchSpeed = 10.0; // Much slower
    float crunchTime = floor(time * crunchSpeed);

    // Random intensity
    float intensity = stepNoise(crunchTime);

    if (intensity > 0.90) { // Less frequent
        float pixelSize = mix(400.0, 150.0, (intensity - 0.90) * 10.0); // Less pixelated
        uv = floor(uv * pixelSize) / pixelSize;
    }

    return uv;
}

// Interlace crunch
float interlaceCrunch(vec2 uv, float time) {
    float speed = 12.0; // Slower
    float shouldInterlace = stepNoise(time * speed);

    if (shouldInterlace > 0.85) { // Less frequent
        float line = mod(floor(uv.y * 400.0), 2.0);
        return line * 0.08; // Much subtler
    }

    return 0.0;
}

// Color crunch - sharp color corruption
vec3 colorCrunch(vec3 color, vec2 uv, float time) {
    float crunchSpeed = 8.0; // Much slower
    float blockSize = 30.0; // Bigger blocks

    vec2 blockId = floor(uv * blockSize);
    float blockTime = floor(time * crunchSpeed);

    float corrupt = step(0.97, hash2d(blockId + blockTime)); // Much less frequent

    if (corrupt > 0.0) {
        // Just swap channels, no invert
        float corruptType = hash2d(blockId + blockTime + 1.0);

        if (corruptType < 0.5) {
            color.rgb = color.gbr; // Rotate
        } else {
            color.rg = color.gr; // Swap
        }
    }

    return color;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply jitter shake - sharp and jarring
    uv += jitterShake(time);

    // Apply horizontal crunch
    uv = horizontalCrunch(uv, time);

    // Apply vertical crunch
    uv = verticalCrunch(uv, time);

    // Apply screen squash
    uv = screenSquash(uv, time);

    // Apply block crunch
    uv = blockCrunch(uv, time);

    // Apply scan corruption
    uv = scanCorruption(uv, time);

    // Apply pixel crunch
    uv = pixelCrunch(uv, time);

    // Clamp UV
    uv = clamp(uv, 0.0, 1.0);

    // Get color with chromatic crunch
    vec4 color = crunchChromatic(uv, time);

    // Apply interlace crunch
    float interlace = interlaceCrunch(v_texcoord, time);
    color.rgb *= (1.0 - interlace);

    // Apply color crunch
    color.rgb = colorCrunch(color.rgb, v_texcoord, time);

    // Sharp brightness crunch
    float brightSpeed = 18.0; // Slower
    float brightness = 0.97 + stepNoise(time * brightSpeed) * 0.06; // Much subtler
    color.rgb *= brightness;

    // Random flash crunch
    float flashSpeed = 8.0; // Slower
    float flash = step(0.98, stepNoise(time * flashSpeed)) * 0.15; // Less intense and frequent
    color.rgb += vec3(flash);

    // Vignette with sharp pulse
    vec2 vigPos = v_texcoord * 2.0 - 1.0;
    float vigDist = length(vigPos);
    float vigIntensity = stepNoise(time * 10.0) * 0.1 + 0.2; // Subtler
    float vig = 1.0 - vigDist * vigIntensity;
    color.rgb *= vig;

    // Scanlines
    float scanline = step(0.5, fract(v_texcoord.y * 300.0));
    color.rgb *= 1.0 - scanline * 0.02; // Subtler

    // Sharp noise
    float noise = (stepNoise(dot(v_texcoord, vec2(12.9898, 78.233)) + time * 50.0) - 0.5) * 0.03; // Much subtler
    color.rgb += vec3(noise);

    fragColor = color;
}
