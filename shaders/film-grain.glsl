// FILM GRAIN - Movie grain effect
// Use with: hyprshade on film-grain

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Film grain noise
float filmGrain(vec2 uv, float time) {
    // Animated grain
    vec2 grainUV = uv * 1000.0 + time * 50.0;
    float noise = hash(grainUV);

    // Multiple layers for more organic grain
    noise += hash(grainUV * 2.0) * 0.5;
    noise += hash(grainUV * 4.0) * 0.25;

    return noise / 1.75;
}

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Generate grain
    float grain = filmGrain(v_texcoord, time);

    // Apply grain (centered around 0)
    float grainAmount = (grain - 0.5) * 0.12;

    color.rgb += vec3(grainAmount);

    // Slight vignette for cinematic feel
    vec2 uv = v_texcoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(uv, uv) * 0.15;
    color.rgb *= vignette;

    // Slight contrast boost
    color.rgb = pow(color.rgb, vec3(0.95));

    fragColor = color;
}
