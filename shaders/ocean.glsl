// OCEAN - Cool ocean blue/cyan tint
// Use with: hyprshade on ocean

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Apply ocean tint
    vec3 oceanTint = vec3(0.2, 0.6, 0.8);
    color.rgb = mix(color.rgb, oceanTint, 0.2);

    // Enhance blues and cyans
    color.g *= 1.05;
    color.b *= 1.15;
    color.r *= 0.95;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
