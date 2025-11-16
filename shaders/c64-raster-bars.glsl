#version 300 es
precision highp float;

uniform sampler2D tex;
uniform float time;
in vec2 v_texcoord;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;

    // Sample texture
    vec4 color = texture(tex, uv);

    // Commodore 64 blue tint
    color.rgb = vec3(color.r * 0.3, color.g * 0.4, color.b * 1.0);

    // Animated raster bars (classic C64 demo effect)
    float barPos = mod(time * 0.3, 1.5);
    float bar1 = smoothstep(0.0, 0.05, abs(uv.y - barPos)) *
                 smoothstep(0.15, 0.10, abs(uv.y - barPos));
    float bar2 = smoothstep(0.0, 0.05, abs(uv.y - barPos - 0.15)) *
                 smoothstep(0.15, 0.10, abs(uv.y - barPos - 0.15));
    float bar3 = smoothstep(0.0, 0.05, abs(uv.y - barPos - 0.30)) *
                 smoothstep(0.15, 0.10, abs(uv.y - barPos - 0.30));

    // Colorful raster bars
    vec3 barColor1 = vec3(1.0, 0.0, 1.0) * bar1 * 0.3; // Magenta
    vec3 barColor2 = vec3(0.0, 1.0, 1.0) * bar2 * 0.3; // Cyan
    vec3 barColor3 = vec3(1.0, 1.0, 0.0) * bar3 * 0.3; // Yellow

    color.rgb += barColor1 + barColor2 + barColor3;

    // Scanlines
    float scanline = sin(uv.y * 500.0) * 0.08;
    color.rgb *= (1.0 - scanline);

    fragColor = color;
}
