// SCREEN SHAKE - Earthquake/impact effect
// Animated screen displacement

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(float x) {
    return fract(sin(x) * 43758.5453123);
}

void main() {
    vec2 uv = v_texcoord;
    
    // Random shake
    float shake = sin(time * 4.0) * 0.02;
    uv.x += random(time * 4.0) * shake;
    uv.y += random(time * 4.0 + 1.0) * shake;
    
    // Impact waves
    float wave = sin(time * 4.0) * 0.01;
    uv += wave;
    
    vec4 color = texture(tex, uv);
    
    // Add chromatic aberration during shake
    float r = texture(tex, uv + vec2(shake, 0.0)).r;
    float b = texture(tex, uv - vec2(shake, 0.0)).b;
    color.r = r;
    color.b = b;
    
    fragColor = color;
}
