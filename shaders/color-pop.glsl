// COLOR POP - Enhanced vibrant colors
// Use with: hyprshade on color-pop

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Increase saturation dramatically
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.8);

    // Slight contrast boost
    color.rgb = (color.rgb - 0.5) * 1.2 + 0.5;

    // Enhance individual channels
    color.r = pow(color.r, 0.95);
    color.g = pow(color.g, 0.95);
    color.b = pow(color.b, 0.95);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
