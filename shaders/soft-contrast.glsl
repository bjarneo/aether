// SOFT CONTRAST - Reduced contrast for comfortable viewing
// Use with: hyprshade on soft-contrast

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce contrast
    color.rgb = (color.rgb - 0.5) * 0.7 + 0.5;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
