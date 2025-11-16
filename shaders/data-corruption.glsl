// DATA CORRUPTION - Corrupted data blocks
// Animated glitch blocks and artifacts

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
    vec2 uv = v_texcoord;
    
    // Block coordinates
    vec2 block = floor(uv * vec2(20.0, 15.0));
    float blockRand = random(block);
    
    // Random corruption
    if (blockRand > 0.95) {
        // Shift corrupted blocks
        uv.x += (random(block + vec2(1.0, 0.0)) - 0.5) * 0.1;
        uv.y += (random(block + vec2(0.0, 1.0)) - 0.5) * 0.1;
    }
    
    vec4 color = texture(tex, uv);
    
    // Color corruption
    if (blockRand > 0.97) {
        color.rgb = vec3(random(block), random(block + vec2(1.0, 0.0)), random(block + vec2(0.0, 1.0)));
    }
    
    // Scanline corruption
    float scan = step(0.98, random(vec2(floor(v_texcoord.y * 100.0), time)));
    color.rgb = mix(color.rgb, vec3(1.0, 0.0, 1.0), scan);
    
    fragColor = color;
}
