// READING MODE - E-reader optimized display for long-form text
// Use with: hyprshade on reading-mode

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale for e-ink simulation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Add slight sepia/paper tint
    vec3 sepia = vec3(gray);
    sepia.r *= 1.08;  // Warm tone
    sepia.g *= 1.04;
    sepia.b *= 0.92;  // Reduce blue

    // Increase contrast for sharper text
    sepia = (sepia - 0.5) * 1.3 + 0.5;

    // Reduce overall brightness slightly (paper effect)
    sepia *= 0.92;

    // Clamp to valid range
    color.rgb = clamp(sepia, 0.0, 1.0);

    fragColor = color;
}
