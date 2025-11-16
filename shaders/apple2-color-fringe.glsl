#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;

    // Apple II NTSC color fringing artifact
    float offset = 0.003;
    vec4 colorR = texture(tex, uv + vec2(offset, 0.0));
    vec4 colorG = texture(tex, uv);
    vec4 colorB = texture(tex, uv - vec2(offset, 0.0));

    vec4 color = vec4(colorR.r, colorG.g, colorB.b, colorG.a);

    // Apply green tint (Apple II monitor)
    color.rgb = vec3(color.r * 0.3, color.g * 1.0, color.b * 0.3);

    // Horizontal scanlines
    float scanline = sin(uv.y * 480.0) * 0.1;

    // Animated phosphor persistence effect
    float persistence = sin(time * 2.0 + uv.y * 10.0) * 0.05 + 0.95;

    color.rgb *= (1.0 - scanline) * persistence;

    // NTSC composite video shimmer
    float shimmer = sin(uv.x * 320.0 + time * 5.0) * 0.03;
    color.rgb += vec3(shimmer);

    fragColor = color;
}
