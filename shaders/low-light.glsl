// LOW LIGHT - Reduce brightness for comfortable viewing
// Use with: hyprshade on low-light

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce brightness by 30%
    color.rgb *= 0.7;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
