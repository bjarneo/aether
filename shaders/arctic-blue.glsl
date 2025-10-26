// ARCTIC BLUE - Cold arctic blue/ice tint
// Use with: hyprshade on arctic-blue

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Cold blue tint
    color.r *= 0.85;
    color.g *= 0.95;
    color.b *= 1.25;

    // Increase saturation for icy look
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.2);

    // Increase contrast for crisp look
    color.rgb = (color.rgb - 0.5) * 1.2 + 0.5;

    // Brighten slightly
    color.rgb *= 1.05;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
