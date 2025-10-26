// HOLO INTERFACE - Holographic HUD overlay
// Use with: hyprshade on holo-interface

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float circle(vec2 uv, vec2 center, float radius) {
    return 1.0 - smoothstep(radius - 0.005, radius + 0.005, length(uv - center));
}

float box(vec2 uv, vec2 center, vec2 size) {
    vec2 d = abs(uv - center) - size;
    return 1.0 - smoothstep(0.0, 0.005, max(d.x, d.y));
}

void main() {
    vec4 screenColor = texture(tex, v_texcoord);
    vec2 uv = v_texcoord;

    float holo = 0.0;

    // Corner brackets
    float bracket = 0.0;

    // Top-left
    bracket += box(uv, vec2(0.05, 0.05), vec2(0.03, 0.001));
    bracket += box(uv, vec2(0.05, 0.05), vec2(0.001, 0.03));

    // Top-right
    bracket += box(uv, vec2(0.95, 0.05), vec2(0.03, 0.001));
    bracket += box(uv, vec2(0.95, 0.05), vec2(0.001, 0.03));

    // Bottom-left
    bracket += box(uv, vec2(0.05, 0.95), vec2(0.03, 0.001));
    bracket += box(uv, vec2(0.05, 0.95), vec2(0.001, 0.03));

    // Bottom-right
    bracket += box(uv, vec2(0.95, 0.95), vec2(0.03, 0.001));
    bracket += box(uv, vec2(0.95, 0.95), vec2(0.001, 0.03));

    holo += bracket;

    // Targeting reticle center
    float reticle = 0.0;
    reticle += circle(uv, vec2(0.5, 0.5), 0.08);
    reticle += circle(uv, vec2(0.5, 0.5), 0.05);

    // Crosshair
    reticle += box(uv, vec2(0.5, 0.5), vec2(0.1, 0.001));
    reticle += box(uv, vec2(0.5, 0.5), vec2(0.001, 0.1));

    holo += reticle;

    // Scanning line
    float scanY = fract(time * 0.3);
    if (abs(uv.y - scanY) < 0.002) {
        holo += 0.5;
    }

    // Flicker effect
    float flicker = 0.7 + sin(time * 100.0) * 0.3;
    holo *= flicker;

    // Holographic color (cyan)
    vec3 holoColor = vec3(0.0, 1.0, 1.0);

    // Add scanlines to holo
    float scanlines = sin(uv.y * 500.0) * 0.5 + 0.5;
    holo *= mix(1.0, scanlines, 0.3);

    // Combine with screen
    screenColor.rgb = mix(screenColor.rgb, holoColor, holo * 0.5);

    fragColor = screenColor;
}
