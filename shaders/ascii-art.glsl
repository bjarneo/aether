// ASCII ART - ASCII character overlay
// Animated ASCII pattern effect

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float character(vec2 uv, float brightness) {
    // Simple ASCII-like pattern
    float pattern = 0.0;
    pattern += step(0.3, fract(uv.x * 50.0));
    pattern += step(0.3, fract(uv.y * 50.0));
    return pattern * brightness;
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Convert to brightness
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // ASCII pattern
    vec2 charUV = v_texcoord * 20.0;
    float ascii = character(charUV, brightness);
    
    // Animate pattern
    ascii *= 0.8 + 0.2 * sin(time * 1.0);
    
    // Mix with original
    color.rgb = mix(color.rgb, vec3(ascii), 0.4);
    
    fragColor = color;
}
