// DUOTONE - Two color gradient
// Use with: hyprshade on duotone

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

    // Map to two colors (dark purple to cyan)
    vec3 darkColor = vec3(0.2, 0.0, 0.4);
    vec3 lightColor = vec3(0.0, 0.8, 1.0);

    vec3 duotone = mix(darkColor, lightColor, gray);

    fragColor = vec4(duotone, 1.0);
}
