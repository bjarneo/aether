// TECHNICOLOR - Classic Technicolor film look
// Use with: hyprshade on technicolor

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Boost red and cyan
    color.r *= 1.3;
    color.g *= 1.1;
    color.b *= 1.2;

    // Increase saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.5);

    // Add slight magenta/cyan split toning
    color.r += 0.05;
    color.b += 0.05;

    // High contrast
    color.rgb = pow(color.rgb, vec3(0.9));

    fragColor = color;
}
