// CHROMATIC SHIFT - RGB channel separation
// Use with: hyprshade on chromatic-shift

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    float offset = 0.005;

    vec4 color;
    color.r = texture(tex, v_texcoord + vec2(offset, 0.0)).r;
    color.g = texture(tex, v_texcoord).g;
    color.b = texture(tex, v_texcoord - vec2(offset, 0.0)).b;
    color.a = 1.0;

    fragColor = color;
}
