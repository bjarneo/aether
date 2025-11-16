// Common GLSL utility functions for all shaders
// Include this at the top of shader files that need these utilities

// Pseudo-random number generator
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 2D Noise function
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

// Smooth vignette effect
float vignette(vec2 uv, float strength, float falloff) {
    vec2 center = uv - 0.5;
    float dist = length(center);
    return 1.0 - smoothstep(falloff, 1.0, dist) * strength;
}

// CRT scanlines
float scanlines(vec2 uv, float frequency, float intensity) {
    float line = sin(uv.y * frequency) * 0.5 + 0.5;
    return mix(1.0, line, intensity);
}

// Ease in-out cubic
float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

// Ease in-out quad
float easeInOutQuad(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

// Ease out elastic
float easeOutElastic(float t) {
    float c4 = (2.0 * 3.14159) / 3.0;
    return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Luminance calculation
float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// Chromatic aberration (RGB split)
vec3 chromaticAberration(sampler2D tex, vec2 uv, float amount) {
    float r = texture(tex, uv + vec2(amount, 0.0)).r;
    float g = texture(tex, uv).g;
    float b = texture(tex, uv - vec2(amount, 0.0)).b;
    return vec3(r, g, b);
}

// Desaturate
vec3 desaturate(vec3 color, float amount) {
    float gray = luminance(color);
    return mix(color, vec3(gray), amount);
}
