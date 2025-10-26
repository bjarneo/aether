// DESERT SAND - Warm sandy desert tones
// Use with: hyprshade on desert-sand

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Warm sandy tones
    color.r *= 1.20;
    color.g *= 1.10;
    color.b *= 0.80;

    // Reduce saturation for dusty look
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.75);

    // Reduce contrast
    color.rgb = (color.rgb - 0.5) * 0.85 + 0.5;

    // Add sandy overlay
    vec3 sandColor = vec3(0.9, 0.8, 0.6);
    color.rgb = mix(color.rgb, sandColor, 0.2);

    // Brighten slightly
    color.rgb *= 1.05;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
