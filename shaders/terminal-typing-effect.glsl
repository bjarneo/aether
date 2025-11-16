#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = v_texcoord;

    // Sample texture
    vec4 color = texture(tex, uv);

    // Terminal cyan/green tint
    color.rgb = mix(
        vec3(color.r * 0.2, color.g * 1.0, color.b * 0.8),
        vec3(color.r * 0.3, color.g * 0.9, color.b * 1.0),
        sin(time * 0.5) * 0.5 + 0.5
    );

    // Cursor blink effect - animated line
    float cursorY = mod(time * 0.1, 1.0);
    float cursor = smoothstep(0.0, 0.002, abs(uv.y - cursorY)) *
                   smoothstep(0.02, 0.01, abs(uv.y - cursorY));

    color.rgb += vec3(0.0, 0.8, 0.8) * cursor;

    // Typing flicker effect - random character flicker
    float flicker = rand(vec2(floor(uv.x * 100.0), floor(time * 30.0)));
    if (flicker > 0.98) {
        color.rgb += vec3(0.0, 0.3, 0.3);
    }

    // Subtle scan effect
    float scan = sin(uv.y * 400.0 - time * 2.0) * 0.03;
    color.rgb *= (1.0 - scan);

    // Phosphor glow
    float glow = sin(time * 1.5) * 0.05 + 0.95;
    color.rgb *= glow;

    fragColor = color;
}
