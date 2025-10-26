// GRAYSCALE - Classic black and white
// Use with: hyprshade on grayscale

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale using luminance coefficients
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    fragColor = vec4(vec3(gray), color.a);
}
