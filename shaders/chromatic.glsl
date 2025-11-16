// CHROMATIC ABERRATION - Advanced color separation effect
// Beautiful prismatic color splitting with dynamic dispersion

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float dist = length(offset);
    
    // Dynamic aberration strength (pulsing effect)
    float aberrationStrength = 0.008 + sin(time * 0.5) * 0.003;
    
    // Radial dispersion - stronger at edges
    float radialFactor = dist * 1.5;
    
    // Sample RGB channels with different offsets
    vec2 rOffset = offset * (1.0 + aberrationStrength * radialFactor * 1.2);
    vec2 gOffset = offset * (1.0 + aberrationStrength * radialFactor * 0.8);
    vec2 bOffset = offset * (1.0 + aberrationStrength * radialFactor * 0.6);
    
    // Add subtle wave distortion
    float wave = sin(uv.y * 20.0 + time * 2.0) * 0.002;
    rOffset.x += wave;
    bOffset.x -= wave;
    
    // Sample each color channel
    float r = texture(tex, center + rOffset).r;
    float g = texture(tex, center + gOffset).g;
    float b = texture(tex, center + bOffset).b;
    
    // Additional chromatic fringing for edges
    vec4 original = texture(tex, uv);
    float edgeFactor = smoothstep(0.0, 0.3, dist);
    
    // Mix original with aberrated for smooth transition
    vec3 aberrated = vec3(r, g, b);
    vec3 final = mix(original.rgb, aberrated, edgeFactor * 0.9);
    
    // Subtle vignette to enhance the effect
    float vignette = 1.0 - dist * 0.3;
    final *= vignette;
    
    // Add slight color boost for vivid chromatic effect
    final = pow(final, vec3(0.95));
    
    fragColor = vec4(final, 1.0);
}
