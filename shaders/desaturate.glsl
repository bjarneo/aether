// DESATURATE - Reduce color saturation
// Use with: hyprshade on desaturate

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Mix with original - 50% saturation reduction
    color.rgb = mix(vec3(gray), color.rgb, 0.5);

    fragColor = color;
}
