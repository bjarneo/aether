// ANONYMOUS HACKER - Mr. Robot inspired CRT terminal effect
// Green terminal with glitches, flicker, and CRT artifacts

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Noise
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Scanlines
float scanlines(vec2 uv, float frequency, float intensity) {
    float line = sin(uv.y * frequency) * 0.5 + 0.5;
    return mix(1.0, line, intensity);
}

// Vignette
float vignette(vec2 uv, float strength, float falloff) {
    vec2 center = uv - 0.5;
    float dist = length(center);
    return 1.0 - smoothstep(falloff, 1.0, dist) * strength;
}

// Horizontal tear glitch
vec2 horizontalTear(vec2 uv, float time) {
    float tearTime = floor(time * 3.0);
    float tearNoise = random(vec2(tearTime, 3.0));
    
    if (tearNoise > 0.90) {
        float tearY = fract(tearNoise * 7.0);
        if (uv.y > tearY && uv.y < tearY + 0.15) {
            uv.x += (random(vec2(tearTime, 5.0)) - 0.5) * 0.04;
        }
    }
    return uv;
}

// Digital block glitch
float digitalGlitch(vec2 uv, float time) {
    vec2 blockUV = floor(uv * vec2(60.0, 35.0));
    float blockTime = floor(time * 5.0);
    float glitchChance = random(vec2(blockTime, blockUV.y));
    
    if (glitchChance > 0.97) {
        return random(blockUV + blockTime) * 0.2;
    }
    return 0.0;
}

// Chromatic aberration
vec3 chromaticAberration(vec2 uv, float amount) {
    vec3 result;
    result.r = texture(tex, uv + vec2(amount, 0.0)).r;
    result.g = texture(tex, uv).g;
    result.b = texture(tex, uv - vec2(amount, 0.0)).b;
    return result;
}

void main() {
    vec2 uv = v_texcoord;
    
    // Apply horizontal tear glitch
    uv = horizontalTear(uv, time);
    uv = clamp(uv, 0.0, 1.0);
    
    // Get color with slight chromatic aberration
    vec3 color = chromaticAberration(uv, 0.002);
    
    // Convert to grayscale
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    
    // Apply green terminal phosphor color
    vec3 terminalGreen = vec3(0.15, 1.0, 0.4);
    vec3 result = gray * terminalGreen;
    
    // Blend with original to keep some color (30%)
    result = mix(result, color, 0.30);
    
    // CRT scanlines
    result *= scanlines(v_texcoord, 850.0, 0.15);
    
    // Power flicker effect
    float powerFlicker = 0.94 + 0.06 * sin(time * 30.0);
    float randomDrop = random(vec2(floor(time * 0.8), 0.0));
    if (randomDrop > 0.92) {
        powerFlicker *= 0.7 + 0.3 * fract(sin(time * 50.0) * 43758.5453);
    }
    result *= powerFlicker;
    
    // High frequency phosphor flicker
    float phosphor = 0.97 + 0.03 * sin(time * 130.0 + v_texcoord.y * 12.0);
    result *= phosphor;
    
    // Random screen flicker
    float screenFlicker = step(0.985, random(vec2(floor(time * 5.0), 1.0)));
    result *= (1.0 - screenFlicker * 0.25);
    
    // Add digital block glitches
    result += vec3(digitalGlitch(v_texcoord, time));
    
    // Screen vignette
    result *= vignette(v_texcoord, 0.40, 0.25);
    
    // Boost green channel
    result.g *= 1.12;
    
    // Add static noise
    float staticNoise = (random(v_texcoord * time * 60.0) - 0.5) * 0.025;
    result += vec3(staticNoise);
    
    // Horizontal signal interference bars
    float signalBar = sin(v_texcoord.y * 18.0 + time * 0.5) * 0.5 + 0.5;
    float barNoise = noise(vec2(time * 0.4, 0.0));
    result *= mix(1.0, signalBar, barNoise * 0.08);
    
    // Slight contrast boost
    result = pow(result, vec3(0.92));
    
    fragColor = vec4(result, 1.0);
}
