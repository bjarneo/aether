// CRUNCH MODE - Pixelated screen with shake and effects
// Use with: hyprshade on crunch-mode
// Screen appears as visible pixels with power mode effects

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash2d(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Screen shake
vec2 screenShake(float time) {
    float intensity = 0.006;
    float x = (hash(time * 50.0) - 0.5) * intensity;
    float y = (hash(time * 50.0 + 100.0) - 0.5) * intensity;

    // Extra jolt occasionally
    float jolt = step(0.97, hash(floor(time * 20.0)));
    x += jolt * (hash(time * 100.0) - 0.5) * 0.012;
    y += jolt * (hash(time * 100.0 + 50.0) - 0.5) * 0.012;

    return vec2(x, y);
}

// Pixelate the screen
vec4 pixelate(vec2 uv) {
    // Pixel grid size (barely pixelated - very high resolution)
    vec2 pixelSize = vec2(1.0 / 960.0, 1.0 / 720.0);

    // Get pixel coordinate
    vec2 pixelCoord = floor(uv / pixelSize);
    vec2 pixelUV = pixelCoord * pixelSize + pixelSize * 0.5;

    // Sample texture at pixel center
    return texture(tex, pixelUV);
}

// Particle sparks
float sparks(vec2 uv, float time) {
    float particles = 0.0;

    for(float i = 0.0; i < 8.0; i++) {
        vec2 center = vec2(
            0.3 + hash(i * 7.0) * 0.4,
            0.3 + hash(i * 13.0) * 0.4
        );

        float sparkTime = fract(time * 2.0 + i * 0.5);

        for(float j = 0.0; j < 15.0; j++) {
            float angle = j / 15.0 * 6.28318 + hash(i + j) * 0.5;

            vec2 sparkPos = center + vec2(cos(angle), sin(angle)) * sparkTime * 0.15;
            sparkPos.y += sparkTime * sparkTime * 0.05; // Gravity

            float dist = length(uv - sparkPos);
            float fade = 1.0 - sparkTime;

            particles += exp(-dist * 200.0) * fade * 0.3;
        }
    }

    return particles;
}

// Energy trails
float energyTrails(vec2 uv, float time) {
    float trails = 0.0;

    for(float i = 0.0; i < 10.0; i++) {
        float pathTime = time * (0.5 + hash(i) * 0.5) + i;
        vec2 pos = vec2(
            fract(pathTime * 0.3 + hash(i)),
            0.2 + hash(i + 5.0) * 0.6
        );

        pos.y += sin(pathTime * 3.0) * 0.08;

        float dist = length(uv - pos);
        trails += exp(-dist * 150.0) * 0.4;
    }

    return trails;
}

// Flash zones
float flashZones(vec2 uv, float time) {
    float flash = 0.0;

    for(float i = 0.0; i < 4.0; i++) {
        vec2 center = vec2(
            0.3 + sin(time * 1.5 + i * 2.0) * 0.2,
            0.3 + cos(time * 1.8 + i * 2.5) * 0.2
        );

        float flashTime = fract(time * 3.0 + i);
        float dist = length(uv - center);

        // Expanding ring
        float ring = abs(dist - flashTime * 0.25);
        flash += exp(-ring * 80.0) * (1.0 - flashTime) * 0.4;
    }

    return flash;
}

// Chromatic pulse
vec4 chromaticPulse(vec2 uv) {
    float pulse = sin(time * 15.0) * 0.5 + 0.5;
    float amount = 0.002 + pulse * 0.003;

    float angle = time * 5.0;
    vec2 dir = vec2(cos(angle), sin(angle));

    vec4 color;
    color.r = pixelate(clamp(uv + dir * amount, 0.0, 1.0)).r;
    color.g = pixelate(clamp(uv, 0.0, 1.0)).g;
    color.b = pixelate(clamp(uv - dir * amount, 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// Edge glow
float edgeGlow(vec2 uv, float time) {
    vec2 edgeDist = abs(uv - 0.5);
    float edge = max(edgeDist.x, edgeDist.y);
    float pulse = sin(time * 8.0) * 0.5 + 0.5;
    return smoothstep(0.42, 0.5, edge) * pulse * 0.3;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply screen shake
    uv += screenShake(time);
    uv = clamp(uv, 0.0, 1.0);

    // Get pixelated color with chromatic aberration
    vec4 color = chromaticPulse(uv);

    fragColor = color;
}
