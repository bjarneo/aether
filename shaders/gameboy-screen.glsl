// GAMEBOY SCREEN - Classic Game Boy greenscale with scanlines
// Animated LCD effect with pixel grid

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Convert to grayscale
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Game Boy palette (4 shades of green) - brighter for better text readability
    vec3 palette[4];
    palette[0] = vec3(0.12, 0.28, 0.12);  // Darkest
    palette[1] = vec3(0.35, 0.53, 0.35);
    palette[2] = vec3(0.65, 0.78, 0.35);
    palette[3] = vec3(0.75, 0.88, 0.45);  // Lightest
    
    // Quantize to 4 levels
    int level = int(gray * 3.0);
    vec3 gbColor = palette[level];
    
    // LCD pixel grid
    vec2 pixel = fract(v_texcoord * vec2(160.0, 144.0));
    float grid = smoothstep(0.9, 1.0, max(pixel.x, pixel.y));
    gbColor *= (1.0 - grid * 0.2);
    
    // Scanlines
    float scanline = sin(v_texcoord.y * 288.0) * 0.5 + 0.5;
    gbColor *= mix(0.9, 1.0, scanline);
    
    // LCD flicker
    gbColor *= 0.95 + 0.05 * sin(time * 20.0);
    
    fragColor = vec4(gbColor, 1.0);
}
