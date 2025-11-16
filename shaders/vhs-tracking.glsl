// VHS TRACKING - VHS tape tracking errors
// Authentic VHS distortion with tracking lines

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
    
    // Horizontal tracking errors
    float trackTime = floor(time * 0.5);
    float trackError = random(vec2(trackTime, 0.0));
    
    if (trackError > 0.8) {
        float errorY = random(vec2(trackTime, 1.0));
        float errorHeight = 0.1 + random(vec2(trackTime, 2.0)) * 0.2;
        
        if (uv.y > errorY && uv.y < errorY + errorHeight) {
            // Shift entire line
            uv.x += (random(vec2(trackTime, 3.0)) - 0.5) * 0.1;
            
            // Add noise to tracking error area
            uv.x += (random(vec2(uv.y * 100.0, time * 10.0)) - 0.5) * 0.05;
        }
    }
    
    vec4 color = texture(tex, uv);
    
    // VHS color bleeding (chromatic aberration)
    float bleed = 0.003;
    color.r = texture(tex, uv + vec2(bleed, 0.0)).r;
    color.b = texture(tex, uv - vec2(bleed, 0.0)).b;
    
    // Tape noise
    float noise = (random(uv * time * 10.0) - 0.5) * 0.05;
    color.rgb += vec3(noise);
    
    // Horizontal sync lines
    float syncLine = step(0.98, fract(uv.y * 200.0 + time * 10.0));
    color.rgb += vec3(syncLine * 0.2);
    
    // Desaturation (VHS quality loss)
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), 0.2);
    
    // Brightness/contrast variation
    float brightness = 0.95 + random(vec2(floor(time * 30.0), 0.0)) * 0.1;
    color.rgb *= brightness;
    
    // Scan lines
    float scanline = sin(uv.y * 400.0) * 0.5 + 0.5;
    color.rgb *= mix(0.9, 1.0, scanline);
    
    fragColor = color;
}
