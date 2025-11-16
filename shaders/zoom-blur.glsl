// ZOOM BLUR - Radial motion blur
// Animated zoom blur from center

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = v_texcoord - center;
    
    // Pulsing blur amount
    float blurAmount = 0.02 * (sin(time * 1.5) * 0.5 + 0.5);
    
    // Sample multiple points along radius
    vec4 color = vec4(0.0);
    const int samples = 8;
    
    for (int i = 0; i < samples; i++) {
        float offset = float(i) / float(samples) * blurAmount;
        vec2 sampleUV = v_texcoord - dir * offset;
        color += texture(tex, sampleUV);
    }
    
    color /= float(samples);
    
    fragColor = color;
}
