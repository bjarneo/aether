// CODE RAIN - Binary code falling effect
// Animated digital rain with 0s and 1s

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Digital columns
    float col = floor(v_texcoord.x * 40.0);
    float speed = random(vec2(col, 1.0)) * 1.5 + 0.5;
    
    // Binary rain
    float y = fract(v_texcoord.y - time * speed);
    float binary = step(0.5, random(vec2(col, floor(y * 20.0))));
    
    // Rain intensity
    float rain = smoothstep(0.9, 1.0, y) * binary;
    
    // Green/blue cyberpunk colors
    vec3 rainColor = mix(
        vec3(0.0, 1.0, 0.5),
        vec3(0.0, 0.5, 1.0),
        binary
    );
    
    // Add rain overlay
    color.rgb = mix(color.rgb, rainColor, rain * 0.6);
    
    // Scanline effect
    color.rgb *= 0.9 + 0.1 * sin(v_texcoord.y * 300.0);
    
    fragColor = color;
}
