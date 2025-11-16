// TV STATIC - Analog TV static noise
// Animated white noise with scan interference

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)) + time) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // White noise
    float noise = random(v_texcoord * 100.0);
    
    // Horizontal scan interference
    float scan = sin(v_texcoord.y * 400.0 + time * 4.0) * 0.5 + 0.5;
    
    // Vertical roll
    float roll = fract(v_texcoord.y + time * 0.1);
    float rollBand = smoothstep(0.95, 1.0, roll);
    
    // Mix static with original
    float staticAmount = 0.3 * noise + 0.1 * scan + 0.2 * rollBand;
    color.rgb = mix(color.rgb, vec3(noise), staticAmount);
    
    // Desaturate slightly
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(luma), 0.3);
    
    fragColor = color;
}
