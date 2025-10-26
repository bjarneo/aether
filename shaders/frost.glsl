// FROST - Frosted glass effect
// Use with: hyprshade on frost

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    // Distorted sampling
    vec2 offset = vec2(
        hash(v_texcoord * 100.0) - 0.5,
        hash(v_texcoord * 100.0 + 10.0) - 0.5
    ) * 0.01;

    vec4 color = texture(tex, v_texcoord + offset);

    // Slight blue tint
    color.rgb *= vec3(0.95, 0.98, 1.05);

    // Brightness boost
    color.rgb += vec3(0.05);

    fragColor = color;
}
