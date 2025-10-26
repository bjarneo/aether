// FOREST GREEN - Natural forest green tint
// Use with: hyprshade on forest-green

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Apply forest green overlay
    vec3 forestGreen = vec3(0.2, 0.5, 0.3);
    color.rgb = mix(color.rgb, forestGreen, 0.25);

    // Boost greens
    color.g *= 1.2;
    color.r *= 0.9;
    color.b *= 0.95;

    // Reduce saturation slightly for natural look
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.9);

    // Slight contrast reduction
    color.rgb = (color.rgb - 0.5) * 0.95 + 0.5;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
