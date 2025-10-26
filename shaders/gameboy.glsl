// GAMEBOY - Game Boy green screen
// Use with: hyprshade on gameboy

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Posterize to 4 levels (classic Game Boy)
    gray = floor(gray * 4.0) / 4.0;

    // Game Boy palette
    vec3 palette;
    if (gray < 0.25) {
        palette = vec3(0.06, 0.22, 0.06); // Dark green
    } else if (gray < 0.5) {
        palette = vec3(0.19, 0.38, 0.19); // Medium-dark green
    } else if (gray < 0.75) {
        palette = vec3(0.54, 0.67, 0.06); // Light green
    } else {
        palette = vec3(0.61, 0.73, 0.06); // Lightest green
    }

    fragColor = vec4(palette, 1.0);
}
