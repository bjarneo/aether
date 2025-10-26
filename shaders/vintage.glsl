// VINTAGE - Vintage film look
// Use with: hyprshade on vintage

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

    // Desaturate slightly
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), 0.3);

    // Warm color cast
    color.r *= 1.15;
    color.b *= 0.85;

    // Reduce contrast
    color.rgb = color.rgb * 0.8 + 0.1;

    // Film grain
    float grain = (hash(v_texcoord * 500.0 + time * 10.0) - 0.5) * 0.08;
    color.rgb += vec3(grain);

    // Vignette
    vec2 uv = v_texcoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(uv, uv) * 0.3;
    color.rgb *= vignette;

    fragColor = color;
}
