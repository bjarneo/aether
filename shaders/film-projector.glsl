// FILM PROJECTOR - Authentic film reel with scratches and flicker
// Vintage film projection with dust, grain, and gate weave

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
    vec2 uv = v_texcoord;
    
    // Film gate weave (camera shake)
    float weaveX = sin(time * 2.5) * 0.002;
    float weaveY = cos(time * 3.1) * 0.003;
    uv += vec2(weaveX, weaveY);
    
    vec4 color = texture(tex, uv);
    
    // Film grain
    float grain = (random(uv * time * 10.0) - 0.5) * 0.08;
    color.rgb += vec3(grain);
    
    // Vertical scratches (moving)
    float scratchX = random(vec2(floor(time * 2.0), 0.0));
    if (scratchX > 0.95) {
        float scratchPos = random(vec2(floor(time * 2.0), 1.0));
        if (abs(v_texcoord.x - scratchPos) < 0.001) {
            color.rgb += vec3(0.3);
        }
    }
    
    // Dust particles
    float dust = 0.0;
    for(float i = 0.0; i < 10.0; i++) {
        vec2 dustPos = vec2(
            random(vec2(i, time * 0.3)),
            fract(random(vec2(i, 1.0)) - time * 0.1)
        );
        float dist = length(v_texcoord - dustPos);
        dust += smoothstep(0.01, 0.0, dist);
    }
    color.rgb += vec3(dust * 0.2);
    
    // Film flicker
    float flicker = 0.95 + 0.05 * random(vec2(floor(time * 24.0), 0.0));
    color.rgb *= flicker;
    
    // Vignette (lens falloff)
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.7;
    color.rgb *= vignette;
    
    // Sepia tone
    vec3 sepia = vec3(
        dot(color.rgb, vec3(0.393, 0.769, 0.189)),
        dot(color.rgb, vec3(0.349, 0.686, 0.168)),
        dot(color.rgb, vec3(0.272, 0.534, 0.131))
    );
    color.rgb = mix(color.rgb, sepia, 0.3);
    
    // Film frame lines (top/bottom)
    if (v_texcoord.y < 0.02 || v_texcoord.y > 0.98) {
        color.rgb *= 0.5;
    }
    
    fragColor = color;
}
