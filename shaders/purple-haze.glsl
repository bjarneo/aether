// PURPLE HAZE - Purple/magenta tint overlay
// Use with: hyprshade on purple-haze

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Apply purple haze overlay
    vec3 purple = vec3(0.6, 0.2, 0.8);
    color.rgb = mix(color.rgb, purple, 0.2);

    // Slightly increase saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.2);

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
