// CLOAKING DEVICE - Predator-style active camouflage shimmer
// Transparent distortion with heat waves

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vec2 uv = v_texcoord;
    
    // Heat distortion waves
    float wave1 = sin(uv.y * 20.0 + time * 2.0) * 0.01;
    float wave2 = sin(uv.x * 15.0 - time * 1.5) * 0.01;
    float wave3 = noise(uv * 5.0 + time * 0.5) * 0.015;
    
    // Combine distortion
    vec2 distortion = vec2(wave1 + wave3, wave2 + wave3);
    
    // Sample texture with distortion
    vec4 color = texture(tex, uv + distortion);
    
    // Shimmer effect (like light bending)
    float shimmer = noise(uv * 10.0 + time * 3.0);
    shimmer = smoothstep(0.3, 0.7, shimmer);
    
    // Apply shimmer as brightness variation
    color.rgb += vec3(shimmer * 0.15);
    
    // Edge detection for cloaking boundaries
    vec2 offset = vec2(0.003, 0.003);
    vec4 c1 = texture(tex, uv + offset + distortion);
    vec4 c2 = texture(tex, uv - offset + distortion);
    float edge = length(c1.rgb - c2.rgb);
    
    // Visible edges (cloaking shimmer)
    color.rgb += vec3(edge * 0.5);
    
    // Chromatic aberration on edges
    if (edge > 0.1) {
        float r = texture(tex, uv + distortion + vec2(0.002, 0.0)).r;
        float b = texture(tex, uv + distortion - vec2(0.002, 0.0)).b;
        color.r = mix(color.r, r, 0.5);
        color.b = mix(color.b, b, 0.5);
    }
    
    // Transparency variation
    float alpha = 0.85 + shimmer * 0.15;
    
    fragColor = vec4(color.rgb, alpha);
}
