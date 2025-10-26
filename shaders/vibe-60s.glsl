// VIBE 60S - 1960s psychedelic/mod color palette
// Use with: hyprshade on vibe-60s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Bright, saturated colors with slight magenta/yellow shift
    // Boost saturation heavily
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.6);

    // Add slight magenta/yellow shift (psychedelic)
    color.r *= 1.1;
    color.b *= 1.1;
    color.g *= 0.95;

    // Reduce contrast slightly for dreamy look
    color.rgb = (color.rgb - 0.5) * 0.9 + 0.5;

    // Brighten overall
    color.rgb *= 1.1;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
