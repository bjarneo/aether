// HOLOGRAPHIC FOIL - Modern holographic shimmer effect
// Rainbow iridescent foil with movement

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
    
    // Animated angle for foil effect
    float angle = time * 0.5 + v_texcoord.x * 2.0 + v_texcoord.y * 3.0;
    
    // Rainbow spectrum based on angle
    vec3 rainbow;
    rainbow.r = sin(angle + 0.0) * 0.5 + 0.5;
    rainbow.g = sin(angle + 2.094) * 0.5 + 0.5;
    rainbow.b = sin(angle + 4.189) * 0.5 + 0.5;
    
    // Holographic pattern (interference)
    float pattern = 0.0;
    pattern += sin(v_texcoord.x * 50.0 + time) * 0.5;
    pattern += sin(v_texcoord.y * 50.0 - time * 0.7) * 0.5;
    pattern = pattern * 0.5 + 0.5;
    
    // Shimmer intensity
    float shimmer = sin(v_texcoord.x * 100.0 + v_texcoord.y * 100.0 + time * 2.0);
    shimmer = shimmer * 0.5 + 0.5;
    shimmer = pow(shimmer, 3.0); // Sharper highlights
    
    // Apply foil effect
    vec3 foilColor = rainbow * pattern * shimmer;
    
    // Blend with original
    color.rgb += foilColor * 0.2;
    
    // Add metallic highlights
    float highlight = pow(shimmer, 5.0);
    color.rgb += vec3(highlight * 0.3);
    
    fragColor = color;
}
