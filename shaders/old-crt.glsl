// OLD CRT - Authentic curved CRT monitor effect
// Use with: hyprshade on old-crt
// Simulates old curved glass CRT monitors with curvature and depth

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// CRT curvature - simulates the curved glass
vec2 curveScreen(vec2 uv) {
    // Convert to centered coordinates
    uv = uv * 2.0 - 1.0;

    // Apply barrel distortion (curved screen effect)
    float curvature = 0.15; // Strength of curve
    vec2 offset = uv.yx / vec2(4.0, 3.0); // Aspect ratio compensation
    uv = uv + uv * offset * offset * curvature;

    // Convert back to UV space
    uv = uv * 0.5 + 0.5;

    return uv;
}

// Screen edge - black bars outside the curved screen
float screenEdge(vec2 uv) {
    // After curvature, check if we're outside screen bounds
    vec2 edge = smoothstep(0.0, 0.02, uv) * smoothstep(1.0, 0.98, uv);
    return edge.x * edge.y;
}

// Scanlines - horizontal lines across CRT
float scanlines(vec2 uv, float intensity) {
    float line = sin(uv.y * 600.0) * 0.5 + 0.5;
    float scanline = mix(1.0, line, intensity);
    return scanline;
}

// Shadow mask - RGB phosphor pattern
vec3 shadowMask(vec2 uv) {
    // Trinitron-style vertical RGB stripes
    float mask = fract(uv.x * 800.0 / 3.0);

    vec3 color;
    if (mask < 0.333) {
        color = vec3(1.0, 0.7, 0.7); // Red phosphor
    } else if (mask < 0.666) {
        color = vec3(0.7, 1.0, 0.7); // Green phosphor
    } else {
        color = vec3(0.7, 0.7, 1.0); // Blue phosphor
    }

    return mix(vec3(1.0), color, 0.3);
}

// Vignette - darker edges like curved glass
float vignette(vec2 uv, float strength, float radius) {
    uv = uv * 2.0 - 1.0;
    float dist = length(uv);

    // Smooth falloff from center
    float vig = smoothstep(radius + strength, radius, dist);

    return vig;
}

// Screen reflection - subtle static highlights on glass
float glassReflection(vec2 uv, float time) {
    // Only subtle static corner reflections
    float cornerTL = exp(-length(uv - vec2(0.15, 0.15)) * 12.0) * 0.04;
    float cornerTR = exp(-length(uv - vec2(0.85, 0.15)) * 12.0) * 0.04;

    return cornerTL + cornerTR;
}

// Bloom/Glow - bright pixels bleed into neighbors
vec4 bloom(sampler2D source, vec2 uv) {
    vec4 color = texture(source, uv);

    // Sample surrounding pixels
    vec4 bloom = vec4(0.0);
    float total = 0.0;

    for(float x = -2.0; x <= 2.0; x++) {
        for(float y = -2.0; y <= 2.0; y++) {
            vec2 offset = vec2(x, y) * 0.002;
            float weight = 1.0 - length(vec2(x, y)) / 3.0;
            bloom += texture(source, uv + offset) * weight;
            total += weight;
        }
    }

    bloom /= total;

    // Mix original with bloom
    return mix(color, bloom, 0.3);
}

// Chromatic aberration - color fringing at edges
vec4 chromaticAberration(vec2 uv) {
    // Stronger aberration at edges
    vec2 center = uv * 2.0 - 1.0;
    float dist = length(center);
    float aberration = dist * 0.003;

    vec4 color;
    color.r = texture(tex, clamp(uv + vec2(aberration, 0.0), 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv - vec2(aberration, 0.0), 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// Screen flicker - unstable CRT power
float flicker(float time) {
    // Slow flicker
    float slowFlicker = sin(time * 4.0) * 0.02;

    // Occasional strong flicker
    float randomFlicker = fract(sin(floor(time * 3.0) * 12.9898) * 43758.5453);
    float strongFlicker = step(0.95, randomFlicker) * 0.08;

    return 1.0 - (slowFlicker + strongFlicker);
}

// CRT noise/static
float crtNoise(vec2 uv, float time) {
    float noise = fract(sin(dot(uv + time * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    return noise * 0.02;
}

// Horizontal sync issues - occasional line displacement
vec2 horizontalSync(vec2 uv, float time) {
    float syncTime = floor(time * 2.0);
    float shouldGlitch = step(0.92, fract(sin(syncTime * 12.9898) * 43758.5453));

    if (shouldGlitch > 0.5) {
        float glitchLine = fract(sin(syncTime * 78.233) * 43758.5453);

        // Thin glitch band
        if (abs(uv.y - glitchLine) < 0.02) {
            float offset = (fract(sin(syncTime * 45.543) * 43758.5453) - 0.5) * 0.02;
            uv.x += offset;
        }
    }

    return uv;
}

// Burn-in effect - ghost images
float burnIn(vec2 uv) {
    // Simulated burned-in shapes (like old terminals with static content)
    vec2 center = abs(uv - 0.5);

    // Faint rectangular burn-in pattern
    float burnRect = smoothstep(0.45, 0.35, max(center.x * 1.5, center.y * 1.2)) * 0.03;

    return burnRect;
}

// Corner shadow - 3D depth effect
float cornerShadow(vec2 uv) {
    vec2 corner = abs(uv - 0.5) * 2.0;

    // Diagonal shadows from corners
    float shadow = pow(max(corner.x, corner.y), 3.0) * 0.3;

    return shadow;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply CRT curvature first
    vec2 curvedUV = curveScreen(uv);

    // Apply horizontal sync issues
    curvedUV = horizontalSync(curvedUV, time);

    // Check screen edge
    float edge = screenEdge(curvedUV);

    // If outside screen bounds, render black
    if (edge < 0.01) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Get color with chromatic aberration
    vec4 color = chromaticAberration(curvedUV);

    // Apply bloom/glow
    color = bloom(tex, curvedUV);

    // Apply shadow mask (phosphor pattern)
    color.rgb *= shadowMask(curvedUV * vec2(1920.0, 1080.0));

    // Apply scanlines
    float scan = scanlines(curvedUV, 0.25);
    color.rgb *= scan;

    // Apply vignette - strong for 3D glass effect
    float vig = vignette(uv, 0.4, 1.3);
    color.rgb *= vig;

    // Apply corner shadows for depth
    float cornerShad = cornerShadow(uv);
    color.rgb *= (1.0 - cornerShad);

    // Apply screen edge fade
    color.rgb *= edge;

    // Apply flicker
    float flick = flicker(time);
    color.rgb *= flick;

    // Add glass reflection
    float reflection = glassReflection(uv, time);
    color.rgb += vec3(reflection);

    // Add CRT noise
    float noise = crtNoise(curvedUV, time);
    color.rgb += vec3(noise);

    // Add burn-in
    float burn = burnIn(uv);
    color.rgb += vec3(burn);

    // Phosphor glow - warm green tint
    color.rgb *= vec3(1.0, 1.05, 0.95);

    // Slight contrast boost (CRTs had punchy colors)
    color.rgb = pow(color.rgb, vec3(0.9));

    // Brightness adjustment
    color.rgb *= 1.1;

    fragColor = color;
}
