// COLOR BLIND DEUTERANOPIA - Simulate deuteranopia (red-green color blindness)
// Use with: hyprshade on color-blind-deuteranopia

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Deuteranopia transformation matrix
    // Removes green sensitivity
    mat3 deuteranopia = mat3(
        0.625, 0.375, 0.0,
        0.7, 0.3, 0.0,
        0.0, 0.3, 0.7
    );

    color.rgb = deuteranopia * color.rgb;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
