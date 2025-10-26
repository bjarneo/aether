// DREAM - Dreamy soft glow
// Use with: hyprshade on dream

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Soft glow blur simulation
    vec4 blurred = vec4(0.0);
    for(float x = -2.0; x <= 2.0; x++) {
        for(float y = -2.0; y <= 2.0; y++) {
            vec2 offset = vec2(x, y) * 0.003;
            blurred += texture(tex, v_texcoord + offset);
        }
    }
    blurred /= 25.0;

    // Mix with original
    color = mix(color, blurred, 0.5);

    // Soft pastel colors
    color.rgb = pow(color.rgb, vec3(0.85));
    color.rgb += vec3(0.05);

    // Slight vignette
    vec2 uv = v_texcoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(uv, uv) * 0.2;
    color.rgb *= vignette;

    fragColor = color;
}
