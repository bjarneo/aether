// THERMAL - Thermal camera vision
// Use with: hyprshade on thermal

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

vec3 heatMap(float t) {
    // Black -> Purple -> Red -> Orange -> Yellow -> White
    vec3 color;
    t = clamp(t, 0.0, 1.0);

    if (t < 0.25) {
        color = mix(vec3(0.0, 0.0, 0.0), vec3(0.5, 0.0, 0.5), t * 4.0);
    } else if (t < 0.5) {
        color = mix(vec3(0.5, 0.0, 0.5), vec3(1.0, 0.0, 0.0), (t - 0.25) * 4.0);
    } else if (t < 0.75) {
        color = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.5, 0.0), (t - 0.5) * 4.0);
    } else {
        color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.75) * 4.0);
    }

    return color;
}

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to luminance
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Apply heat map
    vec3 thermal = heatMap(luma);

    fragColor = vec4(thermal, 1.0);
}
