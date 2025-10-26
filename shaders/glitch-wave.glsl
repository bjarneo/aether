// Glitch Wave - Smooth glitchy wave effects
// Use with: hyprshade on glitch-wave
// Screen shake, vibration, and chromatic aberration effects

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Random function
float random(float seed) {
    return fract(sin(seed) * 43758.5453123);
}

// Smooth random for continuous shake
float smoothRandom(float t) {
    float i = floor(t);
    float f = fract(t);
    float a = random(i);
    float b = random(i + 1.0);
    return mix(a, b, smoothstep(0.0, 1.0, f));
}

// Screen shake offset
vec2 screenShake(float time, float intensity) {
    float shakeSpeed = 30.0;
    float offsetX = (smoothRandom(time * shakeSpeed) - 0.5) * intensity;
    float offsetY = (smoothRandom(time * shakeSpeed + 100.0) - 0.5) * intensity;
    return vec2(offsetX, offsetY);
}

// Chromatic aberration with intensity variation
vec4 chromaticCrunch(vec2 uv, float time) {
    // Vary aberration intensity over time
    float aberrationIntensity = 0.003 + 0.002 * sin(time * 20.0);

    // Add some randomness to direction
    float angle = time * 10.0;
    vec2 direction = vec2(cos(angle), sin(angle)) * 0.5 + vec2(0.5, 0.0);

    vec4 color;
    color.r = texture(tex, uv + direction * aberrationIntensity * 1.5).r;
    color.g = texture(tex, uv).g;
    color.b = texture(tex, uv - direction * aberrationIntensity * 1.5).b;
    color.a = 1.0;

    return color;
}

// Wave distortion
vec2 waveDistortion(vec2 uv, float time) {
    float waveSpeed = 15.0;
    float waveAmplitude = 0.003;

    float distortX = sin(uv.y * 50.0 + time * waveSpeed) * waveAmplitude;
    float distortY = cos(uv.x * 50.0 + time * waveSpeed * 1.3) * waveAmplitude;

    return vec2(distortX, distortY);
}

// Scan line distortion (horizontal lines that shift)
vec2 scanlineDistort(vec2 uv, float time) {
    float scanlineFreq = 100.0;
    float scanlineSpeed = 20.0;
    float scanlineIntensity = 0.002;

    float line = sin(uv.y * scanlineFreq + time * scanlineSpeed);
    float offset = line * scanlineIntensity;

    return vec2(offset, 0.0);
}

// Subtle zoom pulse
vec2 zoomPulse(vec2 uv, float time) {
    float pulseSpeed = 8.0;
    float pulseAmount = 0.005;

    float zoom = 1.0 + sin(time * pulseSpeed) * pulseAmount;
    vec2 center = vec2(0.5, 0.5);

    return (uv - center) * zoom + center;
}

// Edge vignette with pulsing
float dynamicVignette(vec2 uv, float time) {
    vec2 pos = uv * 2.0 - 1.0;
    float dist = length(pos);
    float vignetteStrength = 0.3 + 0.1 * sin(time * 8.0);
    return 1.0 - dist * vignetteStrength;
}

// Glitch bars
float glitchBars(vec2 uv, float time) {
    float barSpeed = 5.0;
    float barFreq = 30.0;

    float bar = step(0.5, fract(sin(floor(uv.y * barFreq + time * barSpeed)) * 43758.5453));
    return bar * 0.05;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply screen shake
    float shakeIntensity = 0.004;
    vec2 shake = screenShake(time, shakeIntensity);
    uv += shake;

    // Apply zoom pulse
    uv = zoomPulse(uv, time);

    // Apply wave distortion
    vec2 wave = waveDistortion(uv, time);
    uv += wave;

    // Apply scanline distortion
    vec2 scanline = scanlineDistort(uv, time);
    uv += scanline;

    // Clamp UV coordinates
    uv = clamp(uv, 0.0, 1.0);

    // Get color with chromatic aberration
    vec4 color = chromaticCrunch(uv, time);

    // Add glitch bars
    float bars = glitchBars(v_texcoord, time);
    color.rgb += vec3(bars);

    // Apply dynamic vignette
    float vig = dynamicVignette(v_texcoord, time);
    color.rgb *= vig;

    // Add subtle brightness pulse
    float brightness = 1.0 + 0.03 * sin(time * 15.0);
    color.rgb *= brightness;

    // Add slight color shift for energy
    float colorShift = sin(time * 10.0) * 0.02;
    color.r += colorShift;
    color.b -= colorShift;

    // Edge glow effect
    vec2 edgeDist = abs(v_texcoord - 0.5);
    float edge = max(edgeDist.x, edgeDist.y);
    float glow = smoothstep(0.45, 0.5, edge) * 0.1 * (0.5 + 0.5 * sin(time * 12.0));
    color.rgb += vec3(glow * 0.3, glow * 0.5, glow);

    fragColor = color;
}
