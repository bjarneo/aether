// TRITONE - Three color gradient mapping
// Use with: hyprshade on tritone

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Map to three colors (shadows, midtones, highlights)
    vec3 shadowColor = vec3(0.1, 0.05, 0.2);    // Dark purple
    vec3 midtoneColor = vec3(0.6, 0.4, 0.5);    // Mauve
    vec3 highlightColor = vec3(1.0, 0.9, 0.7);  // Cream

    vec3 tritone;
    if (gray < 0.5) {
        // Blend between shadow and midtone
        tritone = mix(shadowColor, midtoneColor, gray * 2.0);
    } else {
        // Blend between midtone and highlight
        tritone = mix(midtoneColor, highlightColor, (gray - 0.5) * 2.0);
    }

    fragColor = vec4(tritone, color.a);
}
