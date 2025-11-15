// KINDLE MODE - E-paper display simulation for comfortable reading
// Use with: hyprshade on kindle-mode

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

    // Create warm paper background tone
    vec3 paperColor = vec3(0.96, 0.90, 0.80);  // Warmer cream/beige paper
    vec3 inkColor = vec3(0.15, 0.15, 0.15);     // Dark gray ink (not pure black)

    // Map grayscale to paper-ink range
    // Bright areas become paper color, dark areas become ink color
    vec3 kindle = mix(inkColor, paperColor, gray);

    // Add very high contrast for sharp text (Kindle-like)
    kindle = (kindle - 0.5) * 1.4 + 0.5;

    // Add paper texture effect (prominent grain)
    float noise = fract(sin(dot(v_texcoord * 1000.0, vec2(12.9898, 78.233))) * 43758.5453);
    kindle += (noise - 0.5) * 0.12;  // Strong visible texture

    // Slight vignette for paper edge effect
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.15;
    kindle *= vignette;

    // Clamp to valid range
    color.rgb = clamp(kindle, 0.0, 1.0);

    fragColor = color;
}
