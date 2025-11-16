// AMBER MONITOR - Classic amber phosphor CRT terminal
// Warm amber glow with authentic CRT characteristics

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
    
    // Convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Amber phosphor color (warm orange/yellow)
    vec3 amberColor = vec3(1.0, 0.75, 0.0);
    vec3 result = gray * amberColor;
    
    // Blend with original to keep some syntax colors
    result = mix(result, color.rgb, 0.25);
    
    // CRT scanlines
    float scanline = sin(v_texcoord.y * 600.0) * 0.5 + 0.5;
    result *= mix(0.88, 1.0, scanline);
    
    // Phosphor flicker (60Hz)
    float flicker = 0.97 + 0.03 * sin(time * 60.0 * 2.0 * 3.14159);
    result *= flicker;
    
    // Phosphor glow/bloom on bright areas
    if (gray > 0.7) {
        result += amberColor * (gray - 0.7) * 0.3;
    }
    
    // CRT curvature vignette
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.6;
    result *= vignette;
    
    // Warm overall tone
    result *= vec3(1.05, 1.0, 0.9);
    
    // Random phosphor persistence
    float persistence = random(vec2(v_texcoord.y * 100.0, floor(time * 30.0)));
    result *= (1.0 - persistence * 0.03);
    
    fragColor = vec4(result, 1.0);
}
