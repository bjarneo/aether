// COMIC BOOK - Comic book style
// Use with: hyprshade on comic-book

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Posterize colors
    color.rgb = floor(color.rgb * 6.0) / 6.0;

    // Boost saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.5);

    // Halftone dots
    vec2 dotUV = v_texcoord * 100.0;
    vec2 dotCenter = fract(dotUV) - 0.5;
    float dotDist = length(dotCenter);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float dotSize = (1.0 - luma) * 0.5;

    if (dotDist > dotSize) {
        color.rgb *= 0.9;
    }

    // High contrast
    color.rgb = pow(color.rgb, vec3(0.9));

    fragColor = color;
}
