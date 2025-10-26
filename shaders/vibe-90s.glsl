// VIBE 90S - 1990s slightly desaturated, cool tones
// Use with: hyprshade on vibe-90s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Slightly desaturated with cool tones
    // Reduce saturation moderately
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.85);

    // Cool, slightly blue-green tint
    color.r *= 0.95;
    color.g *= 1.00;
    color.b *= 1.05;

    // Moderate contrast
    color.rgb = (color.rgb - 0.5) * 1.1 + 0.5;

    // Slight darkness in shadows (grunge aesthetic)
    color.rgb = pow(color.rgb, vec3(1.05));

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
