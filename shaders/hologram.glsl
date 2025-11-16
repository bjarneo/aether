// HOLOGRAM - Sci-fi holographic projection effect
// Animated scan lines, flickering, and transparency

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float easeInOutQuad(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Hologram cyan/blue tint
    vec3 holoColor = vec3(0.25, 0.85, 1.0);
    color.rgb *= holoColor;
    
    // Vertical scanning beam (moves from top to bottom)
    float scanCycle = mod(time * 0.4, 1.0);
    float scanPos = easeInOutQuad(scanCycle);
    
    // Main scan beam
    float beamWidth = 0.08;
    float beam = smoothstep(scanPos - beamWidth, scanPos, v_texcoord.y) * 
                 (1.0 - smoothstep(scanPos, scanPos + beamWidth * 0.3, v_texcoord.y));
    
    // Bright scan line
    float scanLine = smoothstep(scanPos - 0.01, scanPos, v_texcoord.y) * 
                     (1.0 - smoothstep(scanPos, scanPos + 0.005, v_texcoord.y));
    
    // Add scan beam glow
    color.rgb += holoColor * beam * 0.6;
    color.rgb += vec3(0.7, 1.0, 1.0) * scanLine * 2.0;
    
    // Horizontal scanlines (static)
    float scanlines = sin(v_texcoord.y * 600.0) * 0.5 + 0.5;
    color.rgb *= mix(0.75, 1.0, scanlines);
    
    // Screen flicker
    float flicker = random(vec2(floor(time * 8.0), 0.0));
    color.rgb *= 0.88 + 0.12 * flicker;
    
    // Glitch flicker (occasional)
    float glitchFlicker = step(0.95, random(vec2(floor(time * 3.0), 1.0)));
    color.rgb *= (1.0 - glitchFlicker * 0.3);
    
    // Horizontal interference bands
    float interference = sin(v_texcoord.y * 30.0 + time * 2.0) * 0.5 + 0.5;
    float bands = smoothstep(0.4, 0.6, interference);
    color.rgb *= mix(0.9, 1.0, bands);
    
    // Transparency variation - creates hologram "gaps"
    float alpha = 0.65;
    alpha += 0.15 * sin(v_texcoord.y * 25.0 + time * 1.5);
    alpha += 0.1 * sin(v_texcoord.y * 8.0 - time * 0.8);
    alpha *= (1.0 - glitchFlicker * 0.5);
    
    // Edge fade for hologram projection feel
    vec2 edge = abs(v_texcoord - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.6, 1.0, max(edge.x, edge.y));
    alpha *= edgeFade;
    
    // Add slight chromatic aberration
    float aberration = 0.002;
    float r = texture(tex, v_texcoord + vec2(aberration, 0.0)).r;
    float b = texture(tex, v_texcoord - vec2(aberration, 0.0)).b;
    color.r = mix(color.r, r * holoColor.r, 0.3);
    color.b = mix(color.b, b * holoColor.b, 0.3);
    
    fragColor = vec4(color.rgb, alpha);
}
