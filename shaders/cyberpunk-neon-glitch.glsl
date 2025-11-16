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

    // Chromatic aberration
    float aberration = sin(time * 2.0) * 0.005;
    vec4 colorR = texture(tex, uv + vec2(aberration, 0.0));
    vec4 colorG = texture(tex, uv);
    vec4 colorB = texture(tex, uv - vec2(aberration, 0.0));

    vec4 color = vec4(colorR.r, colorG.g, colorB.b, colorG.a);

    // Cyberpunk color grading (purple/cyan/pink)
    color.r *= 1.2;
    color.b *= 1.3;

    // Neon glow waves
    float wave1 = sin(uv.y * 10.0 + time * 3.0) * 0.1;
    float wave2 = sin(uv.x * 8.0 - time * 2.0) * 0.1;

    color.rgb += vec3(wave1 * 0.5, wave2 * 0.3, (wave1 + wave2) * 0.4);

    // Digital glitch blocks
    float blockY = floor(uv.y * 20.0);
    float glitch = step(0.98, rand(vec2(blockY, floor(time * 5.0))));

    if (glitch > 0.0) {
        float offset = (rand(vec2(blockY, time)) - 0.5) * 0.1;
        color = texture(tex, uv + vec2(offset, 0.0));
        color.rgb += vec3(rand(vec2(time, blockY)) * 0.5);
    }

    // Scanlines with neon colors
    float scanline = sin(uv.y * 800.0 + time * 1.0) * 0.03;
    color.rgb *= (1.0 - scanline);

    // Pulsing vignette
    float dist = length(uv - 0.5);
    float vignette = 1.0 - dist * (0.4 + sin(time) * 0.2);
    color.rgb *= vignette;

    fragColor = color;
}
