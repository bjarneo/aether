// CEL SHADE - Cel shading / toon effect
// Use with: hyprshade on cel-shade

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Quantize to cel shading levels
    float levels = 4.0;
    color.rgb = floor(color.rgb * levels) / levels;

    // Boost saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.4);

    // Increase contrast
    color.rgb = pow(color.rgb, vec3(0.85));

    fragColor = color;
}
