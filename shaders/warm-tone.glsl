// WARM TONE - Add warm orange/yellow tint
// Use with: hyprshade on warm-tone

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Add warm tint
    color.r *= 1.15;
    color.g *= 1.05;
    color.b *= 0.90;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
