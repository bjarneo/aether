// AMBER - Warm amber/orange tint for night reading
// Use with: hyprshade on amber

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale first
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Apply amber tone
    vec3 amber;
    amber.r = gray * 1.3;
    amber.g = gray * 0.9;
    amber.b = gray * 0.5;

    // Mix with original for subtle effect
    color.rgb = mix(color.rgb, amber, 0.6);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
