// XRAY - X-ray vision effect
// Use with: hyprshade on xray

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Invert and convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    gray = 1.0 - gray;

    // High contrast
    gray = pow(gray, 0.6) * 1.3;

    // Blue tint
    vec3 xray = vec3(gray * 0.5, gray * 0.7, gray * 1.0);

    fragColor = vec4(xray, 1.0);
}
