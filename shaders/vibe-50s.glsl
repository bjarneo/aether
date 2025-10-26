// VIBE 50S - 1950s Technicolor cinema look
// Use with: hyprshade on vibe-50s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Technicolor look: saturated, high contrast, slightly warm
    // Boost reds and cyans
    color.r = pow(color.r, 0.9) * 1.1;
    color.g = pow(color.g, 0.95);
    color.b = pow(color.b, 0.85) * 1.05;

    // Increase overall saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.4);

    // Increase contrast
    color.rgb = (color.rgb - 0.5) * 1.3 + 0.5;

    // Slight warm tint
    color.r *= 1.05;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
