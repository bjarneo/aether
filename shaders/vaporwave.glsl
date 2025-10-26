// VAPORWAVE - Aesthetic vaporwave colors
// Use with: hyprshade on vaporwave

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Pink/cyan color grading
    color.r *= 1.3;
    color.b *= 1.2;
    color.g *= 0.9;

    // Add gradient wash
    float gradient = v_texcoord.y;
    color.rgb += vec3(0.1, 0.0, 0.15) * gradient;
    color.rgb -= vec3(0.0, 0.05, 0.1) * (1.0 - gradient);

    // Scanlines
    float scanline = sin(v_texcoord.y * 300.0 + time * 2.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, 0.15);

    // Slight saturation boost
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.3);

    fragColor = color;
}
