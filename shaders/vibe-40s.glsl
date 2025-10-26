// VIBE 40S - 1940s film noir aesthetic
// Use with: hyprshade on vibe-40s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // High contrast black and white with slight warmth
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Increase contrast dramatically
    gray = (gray - 0.5) * 1.6 + 0.5;
    gray = clamp(gray, 0.0, 1.0);

    // Slight sepia/warm tone
    vec3 noir;
    noir.r = gray * 1.05;
    noir.g = gray * 0.98;
    noir.b = gray * 0.90;

    // Add vignette for film noir look
    vec2 center = v_texcoord - vec2(0.5);
    float vignette = 1.0 - dot(center, center) * 1.5;
    vignette = smoothstep(0.2, 1.0, vignette);

    noir *= vignette;

    // Clamp to valid range
    noir = clamp(noir, 0.0, 1.0);

    fragColor = vec4(noir, color.a);
}
