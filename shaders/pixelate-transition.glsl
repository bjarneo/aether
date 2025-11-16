// PIXELATE TRANSITION - Dynamic pixelation effect
// Animated pixel size changes

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    // Oscillating pixel size: smooth transition from readable (1000) to pixelated (5) and back
    // One full cycle in exactly 5 seconds for perfect video export
    // Using abs(sin) to create smooth in/out animation
    // Frequency: 2*PI / 5 = 1.2566 (to complete one abs(sin) cycle in 5 seconds)
    float wave = abs(sin(time * 0.628318)); // PI/5 for 5-second cycle
    
    // When wave = 0: fully readable (pixelSize = 1000)
    // When wave = 1: very pixelated (pixelSize = 5)
    float pixelSize = mix(1000.0, 5.0, wave);
    
    // Pixelate
    vec2 pixelatedUV = floor(v_texcoord * pixelSize) / pixelSize;
    vec4 color = texture(tex, pixelatedUV);
    
    // Add pixel borders (only when pixelated)
    if (pixelSize < 50.0) {
        vec2 pixel = fract(v_texcoord * pixelSize);
        float border = step(0.9, max(pixel.x, pixel.y));
        color.rgb = mix(color.rgb, color.rgb * 0.7, border);
    }
    
    fragColor = color;
}
