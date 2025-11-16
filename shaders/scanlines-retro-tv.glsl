#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

float rand(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
}

void main() {
    vec2 uv = v_texcoord;

    // Rolling scanlines
    float roll = mod(time * 0.5, 1.0);
    float scanline = sin((uv.y - roll * 0.1) * 800.0) * 0.15;

    // Sample texture with slight vertical shift
    vec2 shiftUv = uv;
    shiftUv.y = mod(shiftUv.y - roll * 0.02, 1.0);

    vec4 color = texture(tex, shiftUv);

    // Apply scanlines
    color.rgb *= (1.0 - scanline);

    // Horizontal sync issues
    float syncNoise = rand(floor(time * 5.0));
    if (syncNoise > 0.95) {
        float offset = (rand(time) - 0.5) * 0.02;
        color = texture(tex, shiftUv + vec2(offset, 0.0));
    }

    // Retro TV color bleeding
    float bleed = sin(uv.x * 300.0) * 0.02;
    color.r += bleed;
    color.b -= bleed;

    // CRT curvature
    vec2 curved = uv * 2.0 - 1.0;
    curved *= 1.0 + 0.03 * dot(curved, curved);
    curved = (curved + 1.0) * 0.5;

    // Vignette
    float dist = length(curved - 0.5);
    color.rgb *= 1.0 - dist * 0.8;

    // Brightness flicker
    float flicker = rand(floor(time * 30.0)) * 0.03 + 0.97;
    color.rgb *= flicker;

    fragColor = color;
}
