#version 300 es
precision highp float;

// Godzilla Mayhem Shader - Tokyo broadcast interference simulator
// Features: Heavy glitches, shaky cam, rolling static bands, sync-loss
// Use with: hyprshade on godzilla-mayhem

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Random number generator
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 2D noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// TV static
float staticNoise(vec2 uv, float t) {
    return random(uv * t);
}

void main() {
    vec2 uv = v_texcoord;

    // === SHAKY CAM (earthquake-like camera shake) ===
    float shakeSpeed = time * 8.0;
    float shakeIntensity = 0.008;

    // Multi-frequency shake for realistic camera movement
    vec2 shake = vec2(
        sin(shakeSpeed * 2.3) * cos(shakeSpeed * 1.7) * shakeIntensity +
        sin(shakeSpeed * 7.1) * 0.003, // High frequency micro-jitter
        cos(shakeSpeed * 1.9) * sin(shakeSpeed * 2.1) * shakeIntensity +
        cos(shakeSpeed * 5.3) * 0.003
    );
    uv += shake;

    // === ROLLING THICK STATIC BAND ===
    // Thick horizontal band that rolls down the screen
    float bandSpeed = time * 0.5; // Slower roll
    float bandPosition = fract(bandSpeed); // 0-1, repeats
    float bandWidth = 0.15; // Thick band (15% of screen height)

    // Check if current pixel is in the static band
    float bandDist = abs(uv.y - bandPosition);
    float inBand = step(bandDist, bandWidth);

    // Dense static in the band
    float bandStatic = staticNoise(uv * 1000.0, time * 50.0) * inBand;

    // === OCCASIONAL FULL-SCREEN STATIC BURSTS ===
    // Random bursts of static every few seconds
    float burstTime = floor(time * 0.5); // Changes every 2 seconds
    float burstRandom = random(vec2(burstTime, 0.0));
    float burstActive = step(0.85, burstRandom); // 15% chance of burst

    float fullStatic = staticNoise(uv * 800.0, time * 80.0) * burstActive * 0.7;

    // === SYNC-LOSS / HORIZONTAL DISPLACEMENT ===
    // Random horizontal line displacement (like VHS tracking issues)
    float lineY = floor(uv.y * 400.0); // Divide screen into horizontal lines
    float lineRandom = random(vec2(lineY, floor(time * 4.0)));
    float lineGlitch = step(0.92, lineRandom); // 8% of lines glitch

    // Horizontal displacement for glitched lines
    float displacement = (random(vec2(lineY, floor(time * 8.0))) - 0.5) * 0.1 * lineGlitch;
    uv.x += displacement;

    // === CHROMATIC ABERRATION (RGB split) ===
    // Heavy RGB channel separation during glitches
    float aberrationStrength = 0.005 + lineGlitch * 0.015 + burstActive * 0.01;

    vec4 color;
    color.r = texture(tex, clamp(uv + vec2(aberrationStrength, 0.0), 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv - vec2(aberrationStrength, 0.0), 0.0, 1.0)).b;
    color.a = 1.0;

    // === VERTICAL SYNC LOSS (occasional) ===
    // Rare dramatic vertical shift (like broadcast signal loss)
    float vsyncTime = floor(time * 0.3);
    float vsyncRandom = random(vec2(vsyncTime, 1.0));
    float vsyncActive = step(0.95, vsyncRandom); // 5% chance

    if (vsyncActive > 0.5) {
        float vshift = (random(vec2(vsyncTime, 2.0)) - 0.5) * 0.3;
        vec2 vsyncUV = vec2(uv.x, fract(uv.y + vshift));
        color = texture(tex, clamp(vsyncUV, 0.0, 1.0));
    }

    // === SCANLINES (CRT-style) ===
    float scanline = sin(uv.y * 600.0) * 0.05;
    color.rgb -= scanline;

    // === RANDOM PIXEL GLITCHES ===
    // Scattered digital corruption
    float pixelGlitch = step(0.998, random(uv * time * 30.0));
    vec3 glitchColor = vec3(
        random(uv * time * 4.0),
        random(uv * time * 8.0),
        random(uv * time * 4.0)
    );
    color.rgb = mix(color.rgb, glitchColor, pixelGlitch * 0.8);

    // === APPLY STATIC OVERLAYS ===
    // Mix in the thick rolling band static
    color.rgb = mix(color.rgb, vec3(bandStatic), bandStatic * 0.9);

    // Mix in full-screen burst static
    color.rgb = mix(color.rgb, vec3(fullStatic), fullStatic);

    // === BRIGHTNESS FLICKER (power surge effect) ===
    float flicker = 0.95 + sin(time * 137.0) * 0.03 + sin(time * 89.0) * 0.02;
    color.rgb *= flicker;

    // === DESATURATION (broadcast degradation) ===
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), 0.2 + burstActive * 0.3);

    // === VIGNETTE (damaged lens/broadcast edge darkening) ===
    vec2 vignetteUV = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 0.3;
    color.rgb *= vignette;

    // Final clamp to prevent overflow
    fragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}
