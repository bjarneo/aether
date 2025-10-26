// PROTANOPIA - Simulate protanopia (red color blindness)
// Use with: hyprshade on protanopia

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Protanopia transformation matrix
    // Removes red sensitivity
    mat3 protanopia = mat3(
        0.567, 0.433, 0.0,
        0.558, 0.442, 0.0,
        0.0, 0.242, 0.758
    );

    color.rgb = protanopia * color.rgb;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
