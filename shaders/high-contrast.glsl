// HIGH CONTRAST - Enhanced contrast and saturation
// Use with: hyprshade on high-contrast

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Increase contrast
    color.rgb = (color.rgb - 0.5) * 1.5 + 0.5;

    // Increase saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.4);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
