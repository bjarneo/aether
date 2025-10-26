// BLUE LIGHT REDUCE - Reduce blue light for eye comfort
// Use with: hyprshade on blue-light-reduce

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce blue light significantly
    color.r *= 1.0;
    color.g *= 0.95;
    color.b *= 0.75;

    // Add slight warmth
    color.r = min(color.r * 1.05, 1.0);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
