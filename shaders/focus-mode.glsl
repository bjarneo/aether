// FOCUS MODE - Dims screen and reduces saturation for minimal distraction
// Use with: hyprshade on focus-mode

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Calculate grayscale value
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Heavy desaturation (keep 20% original color)
    color.rgb = mix(vec3(gray), color.rgb, 0.2);

    // Add subtle vignette effect (darken edges)
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.2;
    color.rgb *= vignette;

    // Increase contrast for better text readability
    color.rgb = (color.rgb - 0.5) * 1.25 + 0.5;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
