// VINTAGE FILM - Classic film look with vignette
// Use with: hyprshade on vintage-film

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Apply vintage color grading
    color.r = pow(color.r, 1.1);
    color.g = pow(color.g, 1.05);
    color.b = pow(color.b, 0.95);

    // Reduce saturation slightly
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 0.85);

    // Add vignette
    vec2 center = v_texcoord - vec2(0.5);
    float vignette = 1.0 - dot(center, center) * 1.2;
    vignette = smoothstep(0.3, 1.0, vignette);

    color.rgb *= vignette;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
