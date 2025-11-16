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

    // Sample texture
    vec4 color = texture(tex, uv);

    // Red terminal tint
    color.rgb = vec3(color.r * 1.0, color.g * 0.2, color.b * 0.2);

    // Vertical data streams falling down
    float streamSpeed = time * 2.0;
    float stream1 = rand(vec2(floor(uv.x * 20.0), floor(streamSpeed)));
    float stream2 = fract(uv.y * 10.0 - streamSpeed * 0.5);

    // Create flowing data effect
    if (stream1 > 0.95 && stream2 > 0.7) {
        color.rgb += vec3(0.8, 0.2, 0.2) * (1.0 - stream2);
    }

    // Glitch lines
    float glitchLine = step(0.995, rand(vec2(uv.y, floor(time * 10.0))));
    if (glitchLine > 0.0) {
        float offset = (rand(vec2(time, uv.y)) - 0.5) * 0.05;
        color = texture(tex, uv + vec2(offset, 0.0));
        color.rgb = vec3(color.r * 1.0, color.g * 0.2, color.b * 0.2);
        color.rgb += vec3(0.3, 0.0, 0.0);
    }

    // Pulsing glow
    float glow = sin(time * 3.0) * 0.1 + 0.9;
    color.rgb *= glow;

    // Scanlines
    float scanline = sin(uv.y * 600.0) * 0.05;
    color.rgb *= (1.0 - scanline);

    fragColor = color;
}
