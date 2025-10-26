// SYSTEM MELTDOWN - Overheating system failure
// Use with: hyprshade on system-meltdown

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
    // Intensity increases over time (loops every 30 seconds)
    float intensity = fract(time / 30.0);

    vec2 uv = v_texcoord;

    // Heat wave distortion
    float heatWave = sin(uv.y * 20.0 + time * 3.0) * 0.01 * intensity;
    uv.x += heatWave;

    // Glitch displacement (increases with intensity)
    if (hash(floor(time * 10.0)) > (1.0 - intensity * 0.5)) {
        float blockY = floor(uv.y * 15.0);
        if (hash(blockY + time) > 0.8) {
            uv.x += (hash(blockY + time + 1.0) - 0.5) * 0.1 * intensity;
        }
    }

    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture(tex, uv);

    // Red shift (increases with intensity)
    color.r += intensity * 0.5;
    color.gb *= (1.0 - intensity * 0.3);

    // Grid pattern (appears as system fails)
    if (intensity > 0.3) {
        vec2 gridUV = v_texcoord * 20.0;
        if (fract(gridUV.x) < 0.05 || fract(gridUV.y) < 0.05) {
            color.rgb = mix(color.rgb, vec3(1.0, 0.0, 0.0), (intensity - 0.3) * 0.5);
        }
    }

    // Glitch blocks (more frequent as intensity increases)
    vec2 blockPos = floor(v_texcoord * 30.0);
    float glitchThreshold = 1.0 - intensity * 0.5;
    if (hash2d(blockPos + floor(time * 15.0)) > glitchThreshold) {
        color.rgb = vec3(hash(blockPos.x), hash(blockPos.y), hash(blockPos.x + blockPos.y));
    }

    // Static noise (increases)
    float noise = hash2d(v_texcoord * 200.0 + time * 20.0) * intensity * 0.5;
    color.rgb += vec3(noise);

    // Final fade to white (near end)
    if (intensity > 0.8) {
        float fadeAmount = (intensity - 0.8) / 0.2;
        color.rgb = mix(color.rgb, vec3(1.0), fadeAmount * 0.7);
    }

    // Complete meltdown (static)
    if (intensity > 0.95) {
        color.rgb = vec3(hash2d(v_texcoord * 500.0 + time * 50.0));
    }

    fragColor = color;
}
