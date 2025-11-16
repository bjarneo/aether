#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;

    // Wavy distortion
    float wave = sin(uv.y * 10.0 + time * 2.0) * 0.01;
    uv.x += wave;

    // Sample texture
    vec4 color = texture(tex, uv);

    // Vaporwave color palette (pink/purple/cyan gradient)
    float gradient = uv.y;
    vec3 vaporColor = mix(
        vec3(1.0, 0.4, 0.7),  // Pink
        mix(
            vec3(0.5, 0.2, 0.8),  // Purple
            vec3(0.2, 0.8, 1.0),  // Cyan
            gradient
        ),
        gradient
    );

    // Apply vaporwave tint
    color.rgb = mix(color.rgb, vaporColor, 0.3);

    // Grid lines
    float gridX = step(0.98, fract(uv.x * 40.0));
    float gridY = step(0.98, fract((uv.y + time * 0.05) * 30.0));
    float grid = max(gridX, gridY);

    color.rgb += vec3(0.4, 0.0, 0.6) * grid * 0.3;

    // Scanlines
    float scanline = sin(uv.y * 500.0) * 0.05;
    color.rgb *= (1.0 - scanline);

    // Animated glow
    float glow = sin(time * 1.5 + uv.y * 5.0) * 0.1 + 0.9;
    color.rgb *= glow;

    // Vignette
    float dist = length(uv - 0.5);
    color.rgb *= 1.0 - dist * 0.3;

    fragColor = color;
}
