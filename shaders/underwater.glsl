// UNDERWATER - Underwater effect
// Use with: hyprshade on underwater

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;

    // Water wave distortion
    uv.x += sin(uv.y * 10.0 + time * 2.0) * 0.01;
    uv.y += cos(uv.x * 10.0 + time * 1.5) * 0.01;

    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture(tex, uv);

    // Blue-green tint
    color.r *= 0.6;
    color.g *= 0.9;
    color.b *= 1.3;

    // Depth darkening
    float depth = v_texcoord.y;
    color.rgb *= mix(0.5, 1.0, depth);

    // Caustics (light patterns)
    float caustic = sin(v_texcoord.x * 20.0 + time * 3.0) *
                    cos(v_texcoord.y * 20.0 + time * 2.0);
    caustic = caustic * 0.5 + 0.5;
    color.rgb += vec3(0.0, caustic * 0.1, caustic * 0.15);

    fragColor = color;
}
