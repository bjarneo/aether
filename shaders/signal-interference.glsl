// SIGNAL INTERFERENCE - Bad signal/reception
// Animated horizontal bars and color shift

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
    
    // Horizontal displacement
    float line = floor(uv.y * 50.0);
    float displacement = (random(line + time * 0.5) - 0.5) * 0.1;
    uv.x += displacement * step(0.95, random(line + floor(time * 1.0)));
    
    vec4 color = texture(tex, uv);
    
    // Color shift interference
    float shift = sin(time * 4.0 + uv.y * 20.0) * 0.01;
    float r = texture(tex, uv + vec2(shift, 0.0)).r;
    float b = texture(tex, uv - vec2(shift, 0.0)).b;
    
    color.r = r;
    color.b = b;
    
    // Signal bars
    float bar = step(0.98, random(floor(uv.y * 200.0 + time * 4.0)));
    color.rgb = mix(color.rgb, vec3(1.0), bar * 0.5);
    
    fragColor = color;
}
