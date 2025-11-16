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

    // Scanline effect
    float scanline = sin(uv.y * 600.0 - time * 3.0) * 0.05;

    // Amber phosphor glow with flicker
    float flicker = rand(floor(time * 30.0)) * 0.05 + 0.95;
    float glow = (sin(time * 2.0) * 0.06 + 0.94) * flicker;

    // Slight barrel distortion
    vec2 centered = uv - 0.5;
    float r2 = dot(centered, centered);
    vec2 curved = uv + centered * r2 * 0.1;

    // Sample texture
    vec4 color = texture(tex, curved);

    // Apply amber phosphor tint (warm orange)
    color.rgb = vec3(color.r * 1.0, color.g * 0.6, color.b * 0.2);

    // Apply scanlines, glow, and flicker
    color.rgb *= (1.0 - scanline) * glow;

    // Vignette
    float dist = length(uv - 0.5);
    color.rgb *= 1.0 - dist * 0.5;

    fragColor = color;
}
