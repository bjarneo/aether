// GLITCH CORRUPTION - Corrupted signal effect
// Use with: hyprshade on glitch-corruption

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

void main() {
    vec2 uv = v_texcoord;
    float t = floor(time * 10.0);

    // Horizontal block glitches
    float blockY = floor(uv.y * 20.0);
    if (hash(blockY + t) > 0.9) {
        float offset = (hash(blockY + t + 1.0) - 0.5) * 0.2;
        uv.x += offset;
    }

    // Large screen tears
    if (hash(t) > 0.93) {
        float tearLine = hash(t + 1.0);
        if (uv.y > tearLine) {
            uv.x += (hash(t + 2.0) - 0.5) * 0.3;
        }
    }

    // Clamp UV
    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture(tex, uv);

    // RGB channel displacement
    if (hash(t + 3.0) > 0.85) {
        float disp = 0.02;
        color.r = texture(tex, clamp(uv + vec2(disp, 0.0), 0.0, 1.0)).r;
        color.b = texture(tex, clamp(uv - vec2(disp, 0.0), 0.0, 1.0)).b;
    }

    // Block corruption (colored static blocks)
    vec2 blockPos = floor(uv * 30.0);
    if (hash2d(blockPos + t) > 0.97) {
        vec3 corruptColor = vec3(
            hash(blockPos.x + t),
            hash(blockPos.y + t),
            hash(blockPos.x + blockPos.y + t)
        );
        color.rgb = corruptColor;
    }

    // Digital noise
    float noise = hash2d(uv * 100.0 + t) * 0.1;
    color.rgb += vec3(noise);

    fragColor = color;
}
