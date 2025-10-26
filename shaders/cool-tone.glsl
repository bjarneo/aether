// COOL TONE - Add cool blue tint
// Use with: hyprshade on cool-tone

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Add cool tint
    color.r *= 0.90;
    color.g *= 1.00;
    color.b *= 1.15;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
