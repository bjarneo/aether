// CYBERPUNK NEON - High contrast cyan-magenta cyberpunk look
// Use with: hyprshade on cyberpunk-neon

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Extreme saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 2.0);

    // Push cyan-magenta split toning
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    if (luminance < 0.5) {
        // Shadows: cyan/blue
        color.b *= 1.3;
        color.g *= 1.1;
    } else {
        // Highlights: magenta/pink
        color.r *= 1.3;
        color.b *= 1.2;
    }

    // Extreme contrast
    color.rgb = (color.rgb - 0.5) * 1.6 + 0.5;

    // Crush blacks
    color.rgb = max(color.rgb - vec3(0.05), vec3(0.0));

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
