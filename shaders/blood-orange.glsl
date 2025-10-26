// BLOOD ORANGE - Deep orange and red dramatic look
// Use with: hyprshade on blood-orange

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale first for base
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Map to blood orange gradient
    vec3 darkColor = vec3(0.4, 0.05, 0.0);   // Deep red
    vec3 midColor = vec3(0.9, 0.3, 0.0);     // Orange
    vec3 lightColor = vec3(1.0, 0.6, 0.2);   // Light orange

    vec3 bloodOrange;
    if (gray < 0.5) {
        bloodOrange = mix(darkColor, midColor, gray * 2.0);
    } else {
        bloodOrange = mix(midColor, lightColor, (gray - 0.5) * 2.0);
    }

    // Mix with original for subtle effect
    color.rgb = mix(color.rgb, bloodOrange, 0.7);

    // Increase contrast
    color.rgb = (color.rgb - 0.5) * 1.3 + 0.5;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
