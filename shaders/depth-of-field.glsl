// DEPTH OF FIELD - Camera focus blur effect
// Use with: hyprshade on depth-of-field

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Define focus area (center of screen is in focus)
    vec2 center = vec2(0.5, 0.5);
    float distFromCenter = length(v_texcoord - center);

    // Focus range - center is sharp, edges are blurred
    float focusStart = 0.15; // Sharp up to this distance
    float focusEnd = 0.6;    // Fully blurred at this distance

    // Calculate blur amount based on distance
    float blurAmount = smoothstep(focusStart, focusEnd, distFromCenter);

    // Apply blur based on distance
    if (blurAmount > 0.01) {
        vec4 blurred = vec4(0.0);
        float total = 0.0;

        // Blur kernel size increases with distance
        float blurRadius = blurAmount * 3.0;

        for(float x = -3.0; x <= 3.0; x++) {
            for(float y = -3.0; y <= 3.0; y++) {
                vec2 offset = vec2(x, y) * 0.002 * blurRadius;
                float weight = 1.0 - length(vec2(x, y)) / 5.0;
                blurred += texture(tex, clamp(v_texcoord + offset, 0.0, 1.0)) * weight;
                total += weight;
            }
        }

        blurred /= total;

        // Mix sharp and blurred based on distance
        color = mix(color, blurred, blurAmount);
    }

    // Slight vignette to enhance focus on center
    vec2 vigUV = v_texcoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(vigUV, vigUV) * 0.15;
    color.rgb *= vignette;

    // Optional: Animate focus point (breathing effect)
    float focusPulse = sin(time * 0.5) * 0.05;
    color.rgb *= 1.0 + focusPulse * (1.0 - blurAmount);

    fragColor = color;
}
