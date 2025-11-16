// BLADE RUNNER RAIN - Iconic sci-fi rain with neon reflections
// Animated rain drops with bokeh blur and neon city glow

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
    
    // Rain drops
    float numDrops = 150.0;
    float rain = 0.0;
    
    for(float i = 0.0; i < numDrops; i++) {
        float x = random(vec2(i, 0.0));
        float speed = 0.3 + random(vec2(i, 1.0)) * 0.5;
        float y = fract(random(vec2(i, 2.0)) + time * speed);
        
        vec2 dropPos = vec2(x, y);
        float dist = length(v_texcoord - dropPos);
        
        // Drop with trail
        float drop = smoothstep(0.02, 0.0, dist);
        float trail = smoothstep(0.03, 0.0, abs(v_texcoord.x - x)) * 
                      smoothstep(y, y - 0.1, v_texcoord.y);
        
        rain += drop * 0.5 + trail * 0.2;
    }
    
    // Neon cyan/orange reflections on wet surface
    vec3 neonCyan = vec3(0.0, 0.8, 1.0);
    vec3 neonOrange = vec3(1.0, 0.5, 0.0);
    
    float wetness = rain * 0.3;
    float reflectCyan = sin(v_texcoord.x * 10.0 + time) * 0.5 + 0.5;
    vec3 reflection = mix(neonOrange, neonCyan, reflectCyan);
    
    // Apply rain and reflections
    color.rgb += vec3(rain) * 0.4;
    color.rgb += reflection * wetness * 0.3;
    
    // Slight blue tint for night rain
    color.rgb *= vec3(0.9, 0.95, 1.1);
    
    // Bokeh blur on rain drops (simulate depth)
    float bokeh = rain * 0.1;
    color.rgb += vec3(bokeh);
    
    // Vignette
    vec2 center = v_texcoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.5;
    color.rgb *= vignette;
    
    fragColor = color;
}
