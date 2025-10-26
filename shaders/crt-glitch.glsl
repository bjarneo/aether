// CRT Glitch Effect for Hyprland
// Use with: hyprshade on crt-glitch
// Enhanced CRT with glitch artifacts, RGB shift, and digital noise

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Noise function
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

// Scanlines
float scanline(vec2 uv, float intensity) {
    float line = sin(uv.y * 800.0) * 0.5 + 0.5;
    return 1.0 - (1.0 - line) * intensity;
}

// Vignette
float vignette(vec2 uv, float strength) {
    uv = uv * 2.0 - 1.0;
    float dist = length(uv);
    return 1.0 - dist * strength;
}

// Glitch bars - horizontal displacement
float glitchBars(vec2 uv, float time) {
    float glitchLine = floor(uv.y * 40.0 + time * 2.0);
    float glitch = step(0.95, random(vec2(glitchLine, floor(time * 3.0))));
    return glitch;
}

// RGB split with glitch
vec4 glitchRGB(vec2 uv, float amount, float time) {
    // Random glitch intensity
    float glitchIntensity = random(vec2(floor(time * 2.0), 0.0));
    float shouldGlitch = step(0.92, glitchIntensity);

    // Variable displacement
    float displacement = amount * (1.0 + shouldGlitch * 3.0);

    vec4 color;
    color.r = texture(tex, uv + vec2(displacement, 0.0)).r;
    color.g = texture(tex, uv).g;
    color.b = texture(tex, uv - vec2(displacement, 0.0)).b;
    color.a = 1.0;

    return color;
}

// Screen tear effect
vec2 screenTear(vec2 uv, float time) {
    float tearTime = floor(time * 1.5);
    float tearNoise = random(vec2(tearTime, 0.0));

    if (tearNoise > 0.88) {
        float tearY = fract(tearNoise * 10.0);
        if (uv.y > tearY && uv.y < tearY + 0.15) {
            float offset = (random(vec2(tearTime, 1.0)) - 0.5) * 0.05;
            uv.x += offset;
        }
    }

    return uv;
}

// Digital block noise
float blockNoise(vec2 uv, float time) {
    vec2 blockUV = floor(uv * vec2(50.0, 30.0));
    float blockTime = floor(time * 10.0);
    float noise = random(vec2(blockTime, blockUV.y));

    if (noise > 0.95) {
        return random(blockUV + blockTime) * 0.3;
    }
    return 0.0;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply screen tear
    uv = screenTear(uv, time);

    // Check for horizontal glitch bars
    float glitch = glitchBars(uv, time);
    if (glitch > 0.0) {
        float offset = (random(vec2(floor(uv.y * 40.0), floor(time * 3.0))) - 0.5) * 0.03;
        uv.x += offset;
    }

    // Clamp UV to prevent sampling outside texture
    uv = clamp(uv, 0.0, 1.0);

    // Get color with chromatic aberration/glitch
    float aberrationAmount = 0.002 + glitch * 0.008;
    vec4 color = glitchRGB(uv, aberrationAmount, time);

    // Add digital block noise
    float digitalNoise = blockNoise(v_texcoord, time);
    color.rgb += vec3(digitalNoise);

    // Apply scanlines
    float scan = scanline(v_texcoord, 0.2);
    color.rgb *= scan;

    // Apply vignette
    float vig = vignette(v_texcoord, 0.35);
    color.rgb *= vig;

    // CRT flicker
    float flicker = 0.97 + 0.03 * sin(time * 25.0);
    // Random intense flicker
    float randomFlicker = step(0.98, random(vec2(floor(time * 5.0), 0.0)));
    flicker *= (1.0 - randomFlicker * 0.3);
    color.rgb *= flicker;

    // Phosphor glow (green/blue tint)
    color.rgb *= vec3(1.0, 1.03, 1.01);

    // Add subtle static noise
    float staticNoise = (random(v_texcoord * time) - 0.5) * 0.03;
    color.rgb += vec3(staticNoise);

    // Occasional color corruption
    float colorCorrupt = random(vec2(floor(time * 1.0), 0.0));
    if (colorCorrupt > 0.94) {
        color.rg = color.gr;
    }

    fragColor = color;
}
