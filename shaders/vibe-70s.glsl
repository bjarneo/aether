// VIBE 70S - 1970s warm, earthy, faded film stock
// Use with: hyprshade on vibe-70s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Warm, faded look with browns and oranges
    // Reduce saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.8);

    // Add warm, yellowy-orange tint
    color.r *= 1.15;
    color.g *= 1.05;
    color.b *= 0.85;

    // Reduce contrast for faded look
    color.rgb = (color.rgb - 0.5) * 0.85 + 0.5;

    // Slight lift in shadows (faded film)
    color.rgb = color.rgb * 0.9 + vec3(0.1, 0.08, 0.05);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
