// GOLDEN HOUR - Warm golden sunset photography look
// Use with: hyprshade on golden-hour

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Warm golden tones
    color.r *= 1.25;
    color.g *= 1.10;
    color.b *= 0.80;

    // Increase saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.3);

    // Soft contrast for dreamy look
    color.rgb = (color.rgb - 0.5) * 0.95 + 0.5;

    // Lift shadows slightly
    color.rgb = color.rgb * 0.9 + vec3(0.08, 0.06, 0.04);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
