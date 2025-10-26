// CHERRY BLOSSOM - Soft pink spring aesthetic
// Use with: hyprshade on cherry-blossom

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Soft pink tint
    vec3 pinkTint = vec3(1.0, 0.8, 0.9);
    color.rgb = mix(color.rgb, pinkTint, 0.25);

    // Boost reds and reduce blues
    color.r *= 1.15;
    color.g *= 1.05;
    color.b *= 0.95;

    // Reduce saturation for soft look
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.8);

    // Reduce contrast for dreamy feel
    color.rgb = (color.rgb - 0.5) * 0.85 + 0.5;

    // Lighten overall
    color.rgb = color.rgb * 0.85 + vec3(0.15);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
