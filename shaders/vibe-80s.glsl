// VIBE 80S - 1980s neon/Miami Vice aesthetic
// Use with: hyprshade on vibe-80s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // High contrast, saturated, cyan-magenta push
    // Boost saturation heavily
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.5);

    // Push cyan-magenta (Miami Vice colors)
    color.r *= 1.15;  // Boost reds/magentas
    color.b *= 1.15;  // Boost blues/cyans
    color.g *= 0.95;  // Reduce green slightly

    // Increase contrast dramatically
    color.rgb = (color.rgb - 0.5) * 1.4 + 0.5;

    // Add slight glow to bright areas
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    if (brightness > 0.7) {
        color.rgb *= 1.2;
    }

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
