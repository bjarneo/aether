// TERMINAL BOOT - Classic terminal boot sequence effect
// Smooth vertical scan line reveals content like a CRT warming up

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// === Utility Functions ===

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float vignette(vec2 uv, float strength, float falloff) {
    vec2 center = uv - 0.5;
    float dist = length(center);
    return 1.0 - smoothstep(falloff, 1.0, dist) * strength;
}

float scanlines(vec2 uv, float frequency, float intensity) {
    float line = sin(uv.y * frequency) * 0.5 + 0.5;
    return mix(1.0, line, intensity);
}

float easeInOutQuad(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// === Main Shader ===

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Boot sequence timing - 3 second loop
    float cycle = mod(time, 3.0) / 3.0;
    float scanProgress = easeInOutQuad(cycle);
    
    // Vertical scan beam parameters
    float beamPosition = scanProgress;
    float beamWidth = 0.15;
    float glowWidth = 0.03;
    
    // Calculate scan beam intensity
    float beamTrail = smoothstep(beamPosition - beamWidth, beamPosition, v_texcoord.y);
    float beamEdge = smoothstep(beamPosition - glowWidth, beamPosition, v_texcoord.y) * 
                     (1.0 - smoothstep(beamPosition, beamPosition + glowWidth * 0.3, v_texcoord.y));
    
    // Content reveal mask
    float revealed = smoothstep(beamPosition - beamWidth * 0.7, beamPosition - beamWidth * 0.2, v_texcoord.y);
    
    // Terminal phosphor colors
    vec3 phosphorGreen = vec3(0.15, 1.0, 0.45);
    vec3 darkScreen = vec3(0.0, 0.12, 0.04);
    
    // Convert to grayscale and apply phosphor
    float luma = luminance(color.rgb);
    vec3 result = luma * phosphorGreen;
    
    // Apply reveal - dark before scan, bright after
    result = mix(darkScreen * 0.4, result, revealed);
    
    // Add bright scan beam edge
    result += phosphorGreen * beamEdge * 5.0;
    
    // Add beam glow trail
    float beamGlow = exp(-abs(v_texcoord.y - beamPosition) * 12.0) * 0.5;
    result += phosphorGreen * beamGlow * (1.0 - revealed * 0.7);
    
    // CRT scanlines
    result *= scanlines(v_texcoord, 900.0, 0.10);
    
    // Phosphor flicker (high frequency like real CRT)
    float flicker = 0.97 + 0.03 * sin(time * 140.0 + v_texcoord.y * 12.0);
    result *= flicker;
    
    // Random phosphor persistence
    float persistence = random(vec2(v_texcoord.y * 80.0, floor(time * 70.0))) * 0.04;
    result *= (1.0 - persistence);
    
    // Screen vignette
    result *= vignette(v_texcoord, 0.30, 0.25);
    
    // Boost green channel for authenticity
    result.g *= 1.08;
    
    // Add subtle scan noise
    if (abs(v_texcoord.y - beamPosition) < beamWidth * 0.5) {
        float noise = (random(vec2(v_texcoord.x * 120.0, time * 15.0)) - 0.5) * 0.025;
        result += vec3(noise);
    }
    
    fragColor = vec4(result, color.a);
}
