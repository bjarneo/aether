// ANONYMOUS HACKER - Mr. Robot inspired CRT terminal effect
// Use with: hyprshade on fsociety
// Intense flickering CRT with green terminal glow and digital artifacts

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// === RANDOM & NOISE FUNCTIONS ===

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// === SCANLINES ===

float scanlines(vec2 uv, float thickness) {
    float line = sin(uv.y * 900.0) * 0.5 + 0.5;
    return mix(0.6, 1.0, line * thickness);
}

// Interlaced scanlines (like old interlaced video)
float interlacedScanlines(vec2 uv, float time) {
    float field = mod(floor(time * 60.0), 2.0); // 60 Hz field switching
    float line = mod(floor(uv.y * 450.0), 2.0);

    if (field == line) {
        return 1.0;
    } else {
        return 0.85; // Dimmed interlaced lines
    }
}

// === FLICKER EFFECTS ===

// Intense power flicker (like unstable electricity)
float powerFlicker(float time) {
    // Multiple frequencies for chaotic flicker
    float flicker = 1.0;

    // High frequency flicker (60Hz power issues)
    flicker *= 0.92 + 0.08 * sin(time * 120.0 + noise(vec2(time, 0.0)) * 3.14);

    // Random voltage drops
    float dropTime = floor(time * 4.0);
    float dropChance = random(vec2(dropTime, 0.0));
    if (dropChance > 0.85) {
        flicker *= 0.6 + 0.4 * fract(sin(time * 200.0) * 43758.5453);
    }

    // Occasional blackouts
    float blackoutChance = random(vec2(floor(time * 0.5), 1.0));
    if (blackoutChance > 0.97) {
        flicker *= 0.3 + 0.7 * step(0.5, fract(time * 30.0));
    }

    return flicker;
}

// Phosphor flicker (CRT phosphor decay)
float phosphorFlicker(vec2 uv, float time) {
    float decay = 0.98 + 0.02 * noise(uv * 10.0 + time * 5.0);
    return decay;
}

// === CRT EFFECTS ===

// Rolling scanlines (vertical sync issues)
vec2 rollingScanlines(vec2 uv, float time) {
    float rollTime = floor(time * 1.0);
    float rollChance = random(vec2(rollTime, 2.0));

    if (rollChance > 0.92) {
        float rollSpeed = 0.3;
        uv.y = fract(uv.y + time * rollSpeed);
    }

    return uv;
}

// Horizontal tearing (like signal interference)
vec2 horizontalTear(vec2 uv, float time) {
    float tearTime = floor(time * 8.0);
    float tearNoise = random(vec2(tearTime, 3.0));

    if (tearNoise > 0.88) {
        float tearY = fract(tearNoise * 7.0);
        float tearHeight = 0.1 + random(vec2(tearTime, 4.0)) * 0.3;

        if (uv.y > tearY && uv.y < tearY + tearHeight) {
            float offset = (random(vec2(tearTime, 5.0)) - 0.5) * 0.08;
            uv.x += offset;
        }
    }

    return uv;
}

// Digital glitch blocks (pixelated corruption)
float digitalGlitch(vec2 uv, float time) {
    vec2 blockUV = floor(uv * vec2(80.0, 45.0)); // Block grid
    float blockTime = floor(time * 15.0);
    float glitchChance = random(vec2(blockTime, blockUV.y));

    if (glitchChance > 0.96) {
        return random(blockUV + blockTime) * 0.4;
    }

    return 0.0;
}

// === CHROMATIC ABERRATION ===

vec4 chromaticAberration(vec2 uv, float amount, float time) {
    // Varying aberration over time
    float aberrationFlicker = amount * (1.0 + 0.5 * sin(time * 10.0));

    // Random RGB channel shifts
    float rShift = aberrationFlicker * (1.0 + random(vec2(floor(time * 3.0), 0.0)) * 0.5);
    float bShift = aberrationFlicker * (1.0 + random(vec2(floor(time * 3.0), 1.0)) * 0.5);

    vec4 color;
    color.r = texture(tex, clamp(uv + vec2(rShift, 0.0), 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv - vec2(bShift, 0.0), 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// === VIGNETTE ===

float vignette(vec2 uv, float strength) {
    uv = uv * 2.0 - 1.0;
    float dist = length(uv);
    return 1.0 - dist * strength;
}

// === STATIC/NOISE ===

float staticNoise(vec2 uv, float time) {
    // High-frequency white noise
    float noise = random(uv * time * 100.0);

    // Occasional heavy static bursts
    float burstTime = floor(time * 2.0);
    float burstChance = random(vec2(burstTime, 6.0));

    if (burstChance > 0.9) {
        return noise * 0.25;
    }

    return noise * 0.04;
}

// === TERMINAL EFFECTS ===

// Green phosphor tint (like old terminal monitors)
vec3 terminalTint(vec3 color, float intensity) {
    // Classic green terminal CRT phosphor
    vec3 greenTint = vec3(0.1, 1.0, 0.15);

    // Convert to luminance
    float luma = dot(color, vec3(0.299, 0.587, 0.114));

    // Apply green tint while preserving some original color
    return mix(color, greenTint * luma, intensity);
}

// Phosphor glow (bloom on bright pixels)
vec3 phosphorGlow(vec2 uv, float time) {
    vec3 glow = vec3(0.0);
    vec3 center = texture(tex, uv).rgb;

    // Only glow on bright pixels
    float brightness = dot(center, vec3(0.299, 0.587, 0.114));

    if (brightness > 0.6) {
        // Sample surrounding pixels
        for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
                vec2 offset = vec2(x, y) * 0.003;
                glow += texture(tex, uv + offset).rgb;
            }
        }
        glow /= 25.0;
        glow *= 0.3 * brightness;
    }

    return glow;
}

// === SIGNAL INTERFERENCE ===

// Horizontal signal bars (like RF interference)
float signalBars(vec2 uv, float time) {
    float barTime = time * 3.0;
    float bar = sin(uv.y * 20.0 + barTime) * 0.5 + 0.5;

    // Random bar intensity
    float barIntensity = noise(vec2(time * 0.5, 0.0));

    return mix(1.0, bar, barIntensity * 0.15);
}

// === MAIN ===

void main() {
    vec2 uv = v_texcoord;

    // Apply rolling scanlines (vertical sync issues)
    uv = rollingScanlines(uv, time);

    // Apply horizontal tearing
    uv = horizontalTear(uv, time);

    // Clamp UV coordinates
    uv = clamp(uv, 0.0, 1.0);

    // Get color with chromatic aberration
    vec4 color = chromaticAberration(uv, 0.004, time);

    // Add phosphor glow
    vec3 glow = phosphorGlow(uv, time);
    color.rgb += glow;

    // Apply interlaced scanlines
    float interlace = interlacedScanlines(v_texcoord, time);
    color.rgb *= interlace;

    // Apply regular scanlines
    float scan = scanlines(v_texcoord, 0.8);
    color.rgb *= scan;

    // Apply power flicker (INTENSE)
    float flicker = powerFlicker(time);
    color.rgb *= flicker;

    // Apply phosphor decay flicker
    float phosphorDecay = phosphorFlicker(v_texcoord, time);
    color.rgb *= phosphorDecay;

    // Apply vignette
    float vig = vignette(v_texcoord, 0.5);
    color.rgb *= vig;

    // Add digital glitch blocks
    float glitch = digitalGlitch(v_texcoord, time);
    color.rgb += vec3(glitch);

    // Add static noise
    float staticNoi = staticNoise(v_texcoord, time);
    color.rgb += vec3(staticNoi);

    // Apply signal bars
    float bars = signalBars(v_texcoord, time);
    color.rgb *= bars;

    // Apply terminal green tint (70% intensity for hacker aesthetic)
    color.rgb = terminalTint(color.rgb, 0.7);

    // Boost contrast (like old CRT monitors)
    color.rgb = pow(color.rgb, vec3(0.85));

    // Slight brightness reduction (darker = more mysterious)
    color.rgb *= 0.9;

    // Add subtle green glow overall
    color.rgb += vec3(0.0, 0.03, 0.01) * flicker;

    fragColor = color;
}
