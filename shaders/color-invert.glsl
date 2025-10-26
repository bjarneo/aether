// COLOR INVERT - Invert all colors (like dark mode)
// Use with: hyprshade on color-invert

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Invert RGB channels
    color.rgb = vec3(1.0) - color.rgb;

    fragColor = color;
}
