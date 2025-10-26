// SOLARIZE - Solarization effect
// Use with: hyprshade on solarize

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Solarize - invert values above threshold
    float threshold = 0.5;

    if (color.r > threshold) color.r = 1.0 - color.r;
    if (color.g > threshold) color.g = 1.0 - color.g;
    if (color.b > threshold) color.b = 1.0 - color.b;

    fragColor = color;
}
