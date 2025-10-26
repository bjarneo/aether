// NIGHT VISION - Night vision goggles
// Use with: hyprshade on night-vision

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Boost brightness
    luma = pow(luma, 0.8) * 1.3;

    // Green tint
    vec3 green = vec3(0.0, luma * 1.5, luma * 0.5);

    // Circular vignette
    vec2 uv = v_texcoord * 2.0 - 1.0;
    float dist = length(uv);
    float vignette = smoothstep(0.8, 0.4, dist);

    green *= vignette;

    // Noise
    float noise = hash(v_texcoord * 100.0 + time * 5.0) * 0.15;
    green += vec3(noise * 0.2, noise, noise * 0.1);

    // Scanlines
    float scanline = sin(v_texcoord.y * 500.0) * 0.5 + 0.5;
    green *= mix(1.0, scanline, 0.3);

    fragColor = vec4(green, 1.0);
}
