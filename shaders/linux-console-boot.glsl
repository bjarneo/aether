#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = v_texcoord;

    // Sample texture
    vec4 color = texture(tex, uv);

    // Linux console white/gray
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = vec3(brightness * 0.9, brightness * 0.95, brightness * 1.0);

    // Boot sequence effect - text appearing from top
    float bootProgress = mod(time * 0.2, 1.2);
    float reveal = smoothstep(bootProgress - 0.2, bootProgress, uv.y);

    if (reveal < 0.5) {
        color.rgb *= 0.3; // Dim unrevealed areas
    }

    // Cursor at boot line
    float cursorY = clamp(bootProgress, 0.0, 1.0);
    float cursor = smoothstep(0.0, 0.001, abs(uv.y - cursorY)) *
                   smoothstep(0.015, 0.008, abs(uv.y - cursorY));

    if (cursor > 0.0) {
        color.rgb = vec3(1.0); // White cursor
    }

    // Random character flicker (like printing to console)
    if (uv.y < bootProgress && uv.y > bootProgress - 0.05) {
        float flicker = rand(vec2(floor(uv.x * 80.0), floor(time * 20.0)));
        if (flicker > 0.9) {
            color.rgb += vec3(0.4);
        }
    }

    // Scanlines
    float scanline = sin(uv.y * 600.0) * 0.04;
    color.rgb *= (1.0 - scanline);

    fragColor = color;
}
