// PHOSPHOR BURN - CRT phosphor burn-in ghost images
// Authentic CRT burn-in with ghost trails

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Simulate burn-in by showing brighter areas with persistence
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Create ghost image (older content fading slowly)
    vec2 ghostOffset = vec2(
        sin(time * 0.1) * 0.002,
        cos(time * 0.15) * 0.002
    );
    vec4 ghost = texture(tex, v_texcoord + ghostOffset);
    float ghostBrightness = dot(ghost.rgb, vec3(0.299, 0.587, 0.114));
    
    // Burn-in effect (bright areas leave trails)
    if (brightness > 0.6) {
        vec3 burnColor = color.rgb * 0.3;
        color.rgb += burnColor;
    }
    
    // Add ghost image with decay
    color.rgb += ghost.rgb * 0.15 * ghostBrightness;
    
    // Phosphor color tint (green/amber depending on area)
    vec3 phosphorGreen = vec3(0.2, 1.0, 0.3);
    vec3 phosphorAmber = vec3(1.0, 0.8, 0.3);
    
    float tintMix = sin(v_texcoord.y * 5.0) * 0.5 + 0.5;
    vec3 phosphorTint = mix(phosphorGreen, phosphorAmber, tintMix);
    
    // Apply subtle phosphor tint to bright areas
    if (brightness > 0.5) {
        color.rgb = mix(color.rgb, phosphorTint * brightness, 0.1);
    }
    
    // CRT scanlines
    float scanline = sin(v_texcoord.y * 600.0) * 0.5 + 0.5;
    color.rgb *= mix(0.9, 1.0, scanline);
    
    // Phosphor decay flicker
    float decay = 0.98 + 0.02 * random(vec2(v_texcoord.y * 50.0, floor(time * 20.0)));
    color.rgb *= decay;
    
    // Screen curvature vignette
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.4;
    color.rgb *= vignette;
    
    fragColor = color;
}
