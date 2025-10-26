// CYBERPUNK - Neon cyberpunk colors
// Use with: hyprshade on cyberpunk

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Boost cyan and magenta
    color.r *= 1.2;
    color.b *= 1.3;

    // Add cyan/magenta color wash
    float wave = sin(v_texcoord.y * 5.0 + time) * 0.5 + 0.5;
    color.r += wave * 0.1;
    color.b += (1.0 - wave) * 0.1;

    // Scanlines
    float scanline = sin(v_texcoord.y * 600.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, 0.2);

    fragColor = color;
}
