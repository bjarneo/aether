// MATRIX RAIN - Falling green characters like The Matrix
// Authentic digital rain with trailing glow and brightness variation

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float randomTime(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)) + time * 0.1) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // More columns for denser rain
    float numColumns = 80.0;
    float col = floor(v_texcoord.x * numColumns);
    
    // Each column has its own speed and offset
    float colRandom = random(vec2(col, 0.0));
    float speed = colRandom * 0.3 + 0.1; // Slower, varied speeds
    float offset = random(vec2(col, 1.0)) * 2.0;
    
    // Rain position with column offset
    float rainY = fract(v_texcoord.y + offset - time * speed);
    
    // Leading bright character (the "head" of the rain)
    float head = smoothstep(0.98, 1.0, rainY);
    head *= 3.0; // Very bright leading char
    
    // Trailing characters with exponential falloff
    float trail = exp(-pow((1.0 - rainY) * 3.0, 2.0));
    trail *= smoothstep(0.0, 0.1, rainY); // Fade in smoothly
    trail *= 0.8;
    
    // Random character flickering
    float flicker = randomTime(vec2(col, floor(rainY * 20.0)));
    float charBrightness = mix(0.3, 1.0, flicker);
    trail *= charBrightness;
    
    // Combine head and trail
    float totalRain = head + trail;
    
    // Multiple shades of Matrix green
    vec3 darkGreen = vec3(0.0, 0.3, 0.0);
    vec3 midGreen = vec3(0.0, 0.8, 0.2);
    vec3 brightGreen = vec3(0.5, 1.0, 0.5);
    
    // Color gradient based on brightness
    vec3 matrixColor;
    if (totalRain > 1.5) {
        // Very bright - almost white
        matrixColor = mix(brightGreen, vec3(0.9, 1.0, 0.9), (totalRain - 1.5) * 0.6);
    } else if (totalRain > 0.5) {
        matrixColor = mix(midGreen, brightGreen, (totalRain - 0.5));
    } else {
        matrixColor = mix(darkGreen, midGreen, totalRain * 2.0);
    }
    
    // Transform the actual code into Matrix rain
    // Use the original text brightness as rain intensity
    float textBrightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Where there's text, make it fall with the rain
    float rainMask = smoothstep(0.5, 0.9, rainY);
    float textToRain = textBrightness * (1.0 - rainMask);
    
    // Dark background
    vec3 backgroundColor = vec3(0.0, 0.05, 0.0);
    
    // Blend: background + transformed text + falling rain
    color.rgb = backgroundColor;
    
    // Add the original text as green rain characters
    color.rgb += matrixColor * textToRain * 2.0;
    
    // Add the pure rain overlay
    color.rgb += matrixColor * totalRain;
    
    // Subtle scanlines for CRT feel
    float scanline = sin(v_texcoord.y * 400.0) * 0.5 + 0.5;
    color.rgb *= 0.95 + 0.05 * scanline;
    
    // Vertical column shimmer
    float shimmer = sin(col * 100.0 + time * 1.0) * 0.1 + 0.9;
    color.rgb *= shimmer;
    
    fragColor = color;
}
