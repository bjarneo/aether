// POSTERIZE - Posterized colors
// Use with: hyprshade on posterize

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce color levels
    float levels = 8.0;
    color.rgb = floor(color.rgb * levels) / levels;

    fragColor = color;
}
