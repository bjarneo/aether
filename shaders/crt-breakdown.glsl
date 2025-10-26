// CRT BREAKDOWN - Dying CRT monitor effect
// Use with: hyprshade on crt-breakdown

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

// Barrel distortion
vec2 barrelDistortion(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    float distortion = 0.2;
    float r2 = dot(uv, uv);
    uv *= 1.0 + distortion * r2;
    return uv * 0.5 + 0.5;
}

// Vignette
float vignette(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    return pow(1.0 - dot(uv, uv) * 0.5, 1.5);
}

void main() {
    vec2 uv = v_texcoord;

    // Apply barrel distortion
    uv = barrelDistortion(uv);

    // Check bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Chromatic aberration
    float aberration = 0.003;
    vec4 color;
    color.r = texture(tex, uv + vec2(aberration, 0.0)).r;
    color.g = texture(tex, uv).g;
    color.b = texture(tex, uv - vec2(aberration, 0.0)).b;
    color.a = 1.0;

    // Scanlines
    float scanline = sin(uv.y * 600.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, 0.3);

    // Vignette
    color.rgb *= vignette(v_texcoord);

    // Flicker
    float flicker = 0.95 + hash(floor(time * 60.0)) * 0.05;
    color.rgb *= flicker;

    // Random noise
    float noise = (hash(v_texcoord.x * v_texcoord.y + time * 10.0) - 0.5) * 0.1;
    color.rgb += vec3(noise);

    // Occasional strong glitch
    if (hash(floor(time * 3.0)) > 0.95) {
        color.rgb *= 0.5;
    }

    fragColor = color;
}
