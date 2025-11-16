// RGB SPLIT - Chromatic aberration with animation
// Animated RGB channel separation

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    // Oscillating split amount
    float splitAmount = (sin(time * 1.0) * 0.5 + 0.5) * 0.01;
    
    // Different offset for each channel
    float r = texture(tex, v_texcoord + vec2(splitAmount, 0.0)).r;
    float g = texture(tex, v_texcoord).g;
    float b = texture(tex, v_texcoord - vec2(splitAmount, 0.0)).b;
    
    // Vertical split variation
    float vertSplit = sin(v_texcoord.y * 10.0 + time) * splitAmount * 0.5;
    r = texture(tex, v_texcoord + vec2(splitAmount + vertSplit, 0.0)).r;
    b = texture(tex, v_texcoord - vec2(splitAmount + vertSplit, 0.0)).b;
    
    fragColor = vec4(r, g, b, 1.0);
}
