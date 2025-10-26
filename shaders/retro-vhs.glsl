// RETRO VHS - VHS tape effect
// Use with: hyprshade on retro-vhs

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    vec2 uv = v_texcoord;

    // VHS tracking lines
    float trackingOffset = (hash(floor(time * 2.0)) - 0.5) * 0.01;
    uv.x += trackingOffset;

    // Horizontal distortion
    uv.x += sin(uv.y * 100.0 + time * 5.0) * 0.002;

    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture(tex, uv);

    // Scanlines
    float scanline = sin(uv.y * 400.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, 0.4);

    // Color bleed
    color.r *= 1.1;
    color.b *= 0.9;

    // Noise
    float noise = (hash(uv.y + time * 10.0) - 0.5) * 0.1;
    color.rgb += vec3(noise);

    fragColor = color;
}
