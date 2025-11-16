// PULSE WAVE - Circular pulse rings
// Animated expanding rings from center

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    vec2 center = vec2(0.5, 0.5);
    float dist = length(v_texcoord - center);
    
    // Multiple expanding rings
    float pulse1 = sin((dist - time * 0.5) * 20.0);
    float pulse2 = sin((dist - time * 0.3) * 15.0);
    
    // Ring intensity
    float rings = (pulse1 + pulse2) * 0.5;
    rings = smoothstep(0.0, 0.3, rings);
    
    // Colorful pulses
    vec3 pulseColor = vec3(
        sin(time * 1.0) * 0.5 + 0.5,
        cos(time * 1.0) * 0.5 + 0.5,
        sin(time * 1.5) * 0.5 + 0.5
    );
    
    color.rgb += pulseColor * rings * 0.3;
    
    fragColor = color;
}
