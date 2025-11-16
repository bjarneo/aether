#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;

    // Scanline effect
    float scanline = sin(uv.y * 800.0 + time * 2.0) * 0.04;

    // Phosphor glow with slower pulsing
    float glow = sin(time * 1.5) * 0.08 + 0.92;

    // Screen curvature
    vec2 curved = uv * 2.0 - 1.0;
    curved *= 1.0 + 0.02 * dot(curved, curved);
    curved = (curved + 1.0) * 0.5;

    // Sample texture
    vec4 color = texture(tex, curved);

    // Apply green phosphor tint
    color.rgb = vec3(color.r * 0.2, color.g * 1.0, color.b * 0.2);

    // Apply scanlines and glow
    color.rgb *= (1.0 - scanline) * glow;

    // Vignette effect
    float dist = length(uv - 0.5);
    color.rgb *= 1.0 - dist * 0.6;

    fragColor = color;
}
