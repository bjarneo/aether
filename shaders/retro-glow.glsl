// RETRO GLOW - Old terminal with text glow
// Use with: hyprshade on retro-glow

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// CRT screen curvature
vec2 curveScreen(vec2 uv) {
    uv = uv * 2.0 - 1.0;

    // Barrel distortion
    float curvature = 0.12;
    vec2 offset = uv.yx / vec2(4.0, 3.0);
    uv = uv + uv * offset * offset * curvature;

    uv = uv * 0.5 + 0.5;
    return uv;
}

void main() {
    vec2 uv = v_texcoord;

    // Slight drift/shake (even when idle)
    uv.x += sin(time * 2.0) * 0.0005;
    uv.y += cos(time * 1.5) * 0.0003;

    // Apply CRT curvature
    uv = curveScreen(uv);

    // Check if outside screen bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 color = texture(tex, uv);

    // Create glow effect
    vec4 glow = vec4(0.0);
    float total = 0.0;

    for(float x = -3.0; x <= 3.0; x += 1.0) {
        for(float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) * 0.002;
            vec4 sampleColor = texture(tex, clamp(uv + offset, 0.0, 1.0));
            float weight = 1.0 - length(vec2(x, y)) / 4.5;
            glow += sampleColor * weight;
            total += weight;
        }
    }

    glow /= total;

    // Mix original with glow
    color = mix(color, glow, 0.4);

    // Warm phosphor tint (amber/green)
    color.r *= 1.1;
    color.g *= 1.15;
    color.b *= 0.85;

    // Animated scanlines (rolling like old CRT)
    float scanline = sin((uv.y * 400.0) + time * 100.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, 0.15);

    // Very subtle edge vignette
    vec2 vigUV = v_texcoord * 2.0 - 1.0;
    float vigDist = length(vigUV);
    float vignette = 1.0 - vigDist * vigDist * 0.15;
    color.rgb *= vignette;

    // Slight flicker
    float flicker = 0.98 + 0.02 * sin(time * 15.0);
    color.rgb *= flicker;

    // Boost overall brightness slightly
    color.rgb *= 1.05;

    fragColor = color;
}
