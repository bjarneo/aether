// NEON PULSE - Pulsing neon glow effect
// Animated neon borders and highlights

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Pulse frequency
    float pulse = sin(time * 1.5) * 0.5 + 0.5;
    
    // Edge detection
    vec2 offset = vec2(0.002, 0.002);
    float edge = 0.0;
    edge += length(texture(tex, v_texcoord + offset).rgb - color.rgb);
    edge += length(texture(tex, v_texcoord - offset).rgb - color.rgb);
    edge *= 5.0;
    
    // Neon colors (cycling through spectrum)
    vec3 neonColor = vec3(
        sin(time * 1.0) * 0.5 + 0.5,
        sin(time * 1.0 + 2.094) * 0.5 + 0.5,
        sin(time * 1.0 + 4.189) * 0.5 + 0.5
    );
    
    // Add neon glow
    color.rgb += neonColor * edge * pulse * 0.5;
    
    // Boost saturation
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, 1.3);
    
    fragColor = color;
}
