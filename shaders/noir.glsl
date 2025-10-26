// NOIR - High contrast black and white
// Use with: hyprshade on noir

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

    // High contrast
    gray = pow(gray, 0.7);

    // Strong vignette
    vec2 uv = v_texcoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(uv, uv) * 0.4;
    gray *= vignette;

    fragColor = vec4(vec3(gray), color.a);
}
