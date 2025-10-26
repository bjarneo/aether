// MIDNIGHT PURPLE - Deep purple night aesthetic
// Use with: hyprshade on midnight-purple

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Deep purple tint
    vec3 purpleTint = vec3(0.4, 0.2, 0.6);
    color.rgb = mix(color.rgb, purpleTint, 0.35);

    // Boost blues and reds, reduce green
    color.r *= 1.15;
    color.g *= 0.85;
    color.b *= 1.25;

    // Reduce brightness for night feel
    color.rgb *= 0.85;

    // Moderate saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.1);

    // Increase contrast
    color.rgb = (color.rgb - 0.5) * 1.2 + 0.5;

    // Clamp to valid range
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    fragColor = color;
}
