// SCANLINES - Pure scanline effect
// Use with: hyprshade on scanlines

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Strong scanlines
    float scanline = sin(v_texcoord.y * 800.0) * 0.5 + 0.5;
    color.rgb *= mix(0.8, 1.0, scanline);

    fragColor = color;
}
