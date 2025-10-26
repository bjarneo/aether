// PASTEL - Soft pastel color palette
// Use with: hyprshade on pastel

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Reduce saturation and increase brightness for pastel effect
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.6);

    // Lighten the colors
    color.rgb = color.rgb * 0.7 + vec3(0.3);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
