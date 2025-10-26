// FADED MEMORY - Washed out nostalgic look
// Use with: hyprshade on faded-memory

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce saturation significantly
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.6);

    // Reduce contrast dramatically
    color.rgb = (color.rgb - 0.5) * 0.6 + 0.5;

    // Lift everything (washed out look)
    color.rgb = color.rgb * 0.7 + vec3(0.25);

    // Slight warm tint
    color.r *= 1.05;
    color.b *= 0.95;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
