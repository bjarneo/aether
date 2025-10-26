// SUNSET - Warm sunset orange/pink gradient
// Use with: hyprshade on sunset

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Create sunset gradient based on vertical position
    float gradient = v_texcoord.y;
    vec3 sunsetTint = mix(
        vec3(1.0, 0.5, 0.2),  // Orange at bottom
        vec3(0.8, 0.3, 0.5),  // Pink at top
        gradient
    );

    // Blend with original color
    color.rgb = mix(color.rgb, sunsetTint, 0.25);

    // Add warmth
    color.r *= 1.1;
    color.b *= 0.9;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
