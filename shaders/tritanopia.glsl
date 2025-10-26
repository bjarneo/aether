// TRITANOPIA - Simulate tritanopia (blue-yellow color blindness)
// Use with: hyprshade on tritanopia

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Tritanopia transformation matrix
    // Removes blue sensitivity
    mat3 tritanopia = mat3(
        0.95, 0.05, 0.0,
        0.0, 0.433, 0.567,
        0.0, 0.475, 0.525
    );

    color.rgb = tritanopia * color.rgb;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
