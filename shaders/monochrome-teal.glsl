// MONOCHROME TEAL - Cool teal monochrome
// Use with: hyprshade on monochrome-teal

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

    // Apply subtle teal monochrome tint
    color.rgb = vec3(gray * 0.60, gray * 1.00, gray * 0.95);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
