// VIBE 00S - 2000s digital camera/early Instagram look
// Use with: hyprshade on vibe-00s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Over-saturated, high contrast digital camera look
    // Boost saturation significantly
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.3);

    // High contrast (digital camera oversharpening)
    color.rgb = (color.rgb - 0.5) * 1.35 + 0.5;

    // Slight warm/orange tint (early digital sensors)
    color.r *= 1.08;
    color.g *= 1.02;
    color.b *= 0.98;

    // Crush blacks slightly
    color.rgb = color.rgb * 0.95 + vec3(0.0);

    // Boost highlights
    vec3 boosted = color.rgb;
    if (dot(boosted, vec3(0.299, 0.587, 0.114)) > 0.6) {
        boosted *= 1.1;
    }
    color.rgb = boosted;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
