// WAVE DISTORTION - Wavy ripple effect
// Animated sine wave distortion

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;
    
    // Horizontal waves
    uv.x += sin(uv.y * 10.0 + time * 1.5) * 0.02;
    
    // Vertical waves
    uv.y += cos(uv.x * 8.0 + time * 1.0) * 0.02;
    
    // Circular ripples from center
    vec2 center = vec2(0.5, 0.5);
    float dist = length(uv - center);
    float ripple = sin(dist * 20.0 - time * 1.0) * 0.01;
    uv += normalize(uv - center) * ripple;
    
    vec4 color = texture(tex, uv);
    
    fragColor = color;
}
