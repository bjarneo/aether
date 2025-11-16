// THERMAL VISION - Heat vision camera
// Animated thermal color mapping

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

vec3 thermalColor(float heat) {
    vec3 cold = vec3(0.0, 0.0, 0.5);
    vec3 warm = vec3(1.0, 0.5, 0.0);
    vec3 hot = vec3(1.0, 1.0, 0.0);
    
    if (heat < 0.5) {
        return mix(cold, warm, heat * 2.0);
    } else {
        return mix(warm, hot, (heat - 0.5) * 2.0);
    }
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Convert to heat value
    float heat = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Pulsing heat intensity
    heat += sin(time * 1.5 + v_texcoord.y * 10.0) * 0.1;
    
    // Apply thermal color
    vec3 thermal = thermalColor(heat);
    
    // Scanlines
    thermal *= 0.9 + 0.1 * sin(v_texcoord.y * 200.0);
    
    // Noise
    float noise = fract(sin(dot(v_texcoord * 100.0, vec2(12.9898,78.233)) + time) * 43758.5453) * 0.1;
    thermal += noise;
    
    fragColor = vec4(thermal, 1.0);
}
