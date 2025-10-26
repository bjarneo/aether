// SEPIA - Vintage sepia tone effect
// Use with: hyprshade on sepia

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale first
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Apply sepia tone
    vec3 sepia;
    sepia.r = gray * 1.2;
    sepia.g = gray * 1.0;
    sepia.b = gray * 0.8;

    // Clamp to valid range
    sepia = clamp(sepia, 0.0, 1.0);

    fragColor = vec4(sepia, color.a);
}
