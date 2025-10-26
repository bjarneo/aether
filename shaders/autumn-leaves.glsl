// AUTUMN LEAVES - Warm fall colors with reds and yellows
// Use with: hyprshade on autumn-leaves

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Boost reds and yellows
    color.r *= 1.20;
    color.g *= 1.05;
    color.b *= 0.75;

    // Moderate saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.1);

    // Reduce contrast for soft autumn feel
    color.rgb = (color.rgb - 0.5) * 0.9 + 0.5;

    // Add warmth overlay
    vec3 autumnTint = vec3(0.9, 0.6, 0.3);
    color.rgb = mix(color.rgb, autumnTint, 0.15);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
