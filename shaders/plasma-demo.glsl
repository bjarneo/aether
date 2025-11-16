// PLASMA DEMO - Classic demoscene plasma effect
// Mesmerizing colorful plasma waves

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    vec2 uv = v_texcoord * 2.0 - 1.0;
    
    // Multiple plasma frequencies
    float plasma = 0.0;
    
    plasma += sin(uv.x * 10.0 + time);
    plasma += sin(uv.y * 10.0 + time * 1.3);
    plasma += sin((uv.x + uv.y) * 10.0 + time * 0.7);
    plasma += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 10.0 + time * 1.5);
    
    plasma /= 4.0;
    
    // Color cycling through spectrum
    vec3 plasmaColor;
    plasmaColor.r = sin(plasma * 3.14159 + time * 0.5) * 0.5 + 0.5;
    plasmaColor.g = sin(plasma * 3.14159 + time * 0.7 + 2.094) * 0.5 + 0.5;
    plasmaColor.b = sin(plasma * 3.14159 + time * 0.9 + 4.189) * 0.5 + 0.5;
    
    // Blend with original code
    color.rgb = mix(color.rgb, plasmaColor, 0.25);
    
    // Add plasma glow
    color.rgb += plasmaColor * 0.15;
    
    fragColor = color;
}
