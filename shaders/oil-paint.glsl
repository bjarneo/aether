// OIL PAINT - Oil painting effect
// Use with: hyprshade on oil-paint

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = vec4(0.0);

    // Sample nearby pixels with varying weights
    for(float x = -2.0; x <= 2.0; x += 1.0) {
        for(float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * 0.005;
            color += texture(tex, v_texcoord + offset);
        }
    }

    color /= 25.0;

    // Posterize slightly
    color.rgb = floor(color.rgb * 12.0) / 12.0;

    // Boost saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.3);

    fragColor = color;
}
