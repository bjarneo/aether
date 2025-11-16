#version 300 es
precision highp float;

// Liquid Glass + Dithering Shader
// Combines fluid glass-like refractions with retro dithering patterns
// Use with: hyprshade on liquid-glass-dither

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Random number generator
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 2D noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractional Brownian Motion for organic liquid-like patterns
float fbm(vec2 p, float t) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // Layer multiple octaves of noise
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency + t);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

// Bayer matrix 4x4 for ordered dithering
float bayer4x4(vec2 pixel) {
    const mat4 bayerMatrix = mat4(
        0.0 / 16.0,  8.0 / 16.0,  2.0 / 16.0, 10.0 / 16.0,
        12.0 / 16.0, 4.0 / 16.0, 14.0 / 16.0,  6.0 / 16.0,
        3.0 / 16.0, 11.0 / 16.0,  1.0 / 16.0,  9.0 / 16.0,
        15.0 / 16.0, 7.0 / 16.0, 13.0 / 16.0,  5.0 / 16.0
    );

    int x = int(mod(pixel.x, 4.0));
    int y = int(mod(pixel.y, 4.0));

    return bayerMatrix[x][y];
}

// Bayer matrix 8x8 for finer dithering
float bayer8x8(vec2 pixel) {
    int x = int(mod(pixel.x, 8.0));
    int y = int(mod(pixel.y, 8.0));

    const float bayerMatrix8x8[64] = float[64](
         0.0, 32.0,  8.0, 40.0,  2.0, 34.0, 10.0, 42.0,
        48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
        12.0, 44.0,  4.0, 36.0, 14.0, 46.0,  6.0, 38.0,
        60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
         3.0, 35.0, 11.0, 43.0,  1.0, 33.0,  9.0, 41.0,
        51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
        15.0, 47.0,  7.0, 39.0, 13.0, 45.0,  5.0, 37.0,
        63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0
    );

    return bayerMatrix8x8[y * 8 + x] / 64.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 resolution = vec2(1920.0, 1080.0); // Approximate screen resolution
    vec2 pixelCoord = uv * resolution;

    // === LIQUID GLASS DISTORTION ===
    // Create flowing, organic glass-like refractions

    // Slow flowing time for smooth liquid motion
    float flowTime = time * 0.3;

    // Generate flowing patterns using FBM
    vec2 flowPattern1 = vec2(
        fbm(uv * 3.0 + vec2(flowTime * 0.5, flowTime * 0.3), flowTime),
        fbm(uv * 3.0 + vec2(flowTime * 0.4, -flowTime * 0.5), flowTime)
    );

    vec2 flowPattern2 = vec2(
        fbm(uv * 2.0 + flowPattern1 + vec2(-flowTime * 0.3, flowTime * 0.4), flowTime * 0.8),
        fbm(uv * 2.0 + flowPattern1 + vec2(flowTime * 0.4, flowTime * 0.3), flowTime * 0.8)
    );

    // Create glass refraction effect
    // Subtle warping like light passing through liquid glass
    vec2 distortion = (flowPattern2 - 0.5) * 0.02; // Gentle distortion

    // Add caustics-like highlights (concentrated light patterns)
    float caustics = fbm(uv * 8.0 + flowPattern1 * 2.0, flowTime * 1.5);
    caustics = pow(caustics, 3.0) * 0.3; // Sharpen the bright spots

    // Apply distortion with caustic intensity
    vec2 glassUV = uv + distortion * (1.0 + caustics);
    glassUV = clamp(glassUV, 0.0, 1.0);

    // Sample texture with glass distortion
    vec4 color = texture(tex, glassUV);

    // Add caustic highlights (like light through water)
    color.rgb += vec3(caustics * 0.2);

    // === GLASS TINT (subtle blue-green like real glass) ===
    vec3 glassTint = vec3(0.95, 1.0, 1.05); // Slight cyan tint
    color.rgb *= glassTint;

    // === ORDERED DITHERING WITH CENTER SPOTLIGHT ===
    // Apply retro dithering that fades from center to edges

    // Calculate distance from center (0.0 at center, ~1.4 at corners)
    vec2 centerOffset = (uv - 0.5) * 2.0;
    float distFromCenter = length(centerOffset);

    // Create smooth gradient circle for dither strength
    // Inner radius: no dithering (0.0 - 0.3 from center)
    // Outer radius: full dithering (0.6+ from center)
    float innerRadius = 0.2;  // Clear circle radius
    float outerRadius = 0.8;  // Full dither radius

    // Smooth transition using smoothstep
    float ditherGradient = smoothstep(innerRadius, outerRadius, distFromCenter);

    // Get dither threshold from Bayer matrix
    float ditherThreshold = bayer8x8(pixelCoord);

    // Reduce color depth for dithering effect
    float colorLevels = 16.0; // Reduce to 16 levels per channel
    vec3 dithered = floor(color.rgb * colorLevels + ditherThreshold) / colorLevels;

    // Apply dithering with gradient strength
    // Center: 0% dithering (clear), Edges: 80% dithering
    float maxDitherStrength = 0.8;
    float ditherStrength = ditherGradient * maxDitherStrength;
    color.rgb = mix(color.rgb, dithered, ditherStrength);

    // === CHROMATIC ABERRATION (glass prism effect) ===
    // Subtle RGB split at edges like light through glass prism
    // Reuse centerOffset and distFromCenter from dithering section
    float aberrationStrength = distFromCenter * 0.003;

    if (aberrationStrength > 0.001) {
        color.r = texture(tex, clamp(glassUV + vec2(aberrationStrength, 0.0), 0.0, 1.0)).r;
        color.b = texture(tex, clamp(glassUV - vec2(aberrationStrength, 0.0), 0.0, 1.0)).b;
        // Re-apply dithering to aberrated channels
        color.r = mix(color.r, floor(color.r * colorLevels + ditherThreshold) / colorLevels, ditherStrength);
        color.b = mix(color.b, floor(color.b * colorLevels + ditherThreshold) / colorLevels, ditherStrength);
    }

    // === GLASS REFLECTIONS (subtle highlights) ===
    // Add moving specular highlights like reflections on glass surface
    float reflectionPattern = fbm(uv * 6.0 + flowTime * 0.2, flowTime);
    float reflection = pow(reflectionPattern, 4.0) * 0.15;
    color.rgb += vec3(reflection);

    // === SUBTLE VIGNETTE (glass edge darkening) ===
    float vignette = 1.0 - distFromCenter * distFromCenter * 0.2;
    color.rgb *= vignette;

    // Final clamp
    fragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}
