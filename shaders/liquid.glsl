// LIQUID - Fluid flowing distortion effect
// Use with: hyprshade on liquid
// Screen appears to flow and ripple like liquid

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Smooth noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123);
    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453123);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);
    float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for organic flow
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for(int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

// Liquid flow distortion
vec2 liquidFlow(vec2 uv, float time) {
    // Multiple flow layers
    float flow1 = fbm(uv * 3.0 + time * 0.2);
    float flow2 = fbm(uv * 2.0 - time * 0.15 + 10.0);
    float flow3 = fbm(uv * 4.0 + time * 0.25 + 20.0);

    // Combine flows for complex liquid motion
    vec2 distortion;
    distortion.x = (flow1 - 0.5) * 0.02 + (flow3 - 0.5) * 0.01;
    distortion.y = (flow2 - 0.5) * 0.02 + (flow3 - 0.5) * 0.01;

    return distortion;
}

// Ripple effect - like drops on water
vec2 ripple(vec2 uv, float time) {
    // Create multiple ripple sources
    vec2 rippleCenter1 = vec2(0.3 + sin(time * 0.5) * 0.2, 0.5 + cos(time * 0.3) * 0.2);
    vec2 rippleCenter2 = vec2(0.7 + sin(time * 0.4) * 0.15, 0.5 + cos(time * 0.6) * 0.25);

    float dist1 = length(uv - rippleCenter1);
    float dist2 = length(uv - rippleCenter2);

    // Expanding ripples
    float ripple1 = sin(dist1 * 30.0 - time * 3.0) * exp(-dist1 * 3.0);
    float ripple2 = sin(dist2 * 25.0 - time * 2.5) * exp(-dist2 * 2.5);

    // Convert ripples to distortion
    vec2 rippleDir1 = normalize(uv - rippleCenter1);
    vec2 rippleDir2 = normalize(uv - rippleCenter2);

    vec2 distortion = rippleDir1 * ripple1 * 0.008 + rippleDir2 * ripple2 * 0.006;

    return distortion;
}

// Wave distortion - gentle waves
vec2 waves(vec2 uv, float time) {
    float wave1 = sin(uv.y * 10.0 + time * 1.5) * 0.003;
    float wave2 = sin(uv.x * 8.0 - time * 1.2) * 0.003;
    float wave3 = sin((uv.x + uv.y) * 12.0 + time * 1.8) * 0.002;

    return vec2(wave1 + wave3, wave2 + wave3);
}

// Swirl effect - vortex-like motion
vec2 swirl(vec2 uv, float time) {
    vec2 center = vec2(0.5);
    vec2 delta = uv - center;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // Rotating swirl based on distance
    float swirlStrength = 0.3 * exp(-dist * 2.0);
    float rotation = sin(time * 0.8) * swirlStrength;

    float newAngle = angle + rotation;
    vec2 swirlOffset = vec2(cos(newAngle), sin(newAngle)) * dist - delta;

    return swirlOffset * 0.015;
}

// Viscosity effect - slow thick movements
vec2 viscosity(vec2 uv, float time) {
    float slowTime = time * 0.3;

    float visc1 = fbm(uv * 2.5 + slowTime * 0.1);
    float visc2 = fbm(uv * 1.8 - slowTime * 0.08 + 15.0);

    vec2 viscDist;
    viscDist.x = sin(visc1 * 6.28) * 0.015;
    viscDist.y = cos(visc2 * 6.28) * 0.015;

    return viscDist;
}

// Refraction - like light through water
vec4 liquidRefraction(vec2 uv, float time) {
    // Sample with slight offsets for refraction effect
    float refract1 = noise(uv * 5.0 + time * 0.2);
    float refract2 = noise(uv * 5.0 - time * 0.15 + 10.0);

    vec2 refractOffset = vec2(refract1 - 0.5, refract2 - 0.5) * 0.002;

    vec4 color;
    color.r = texture(tex, clamp(uv + refractOffset * 1.2, 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv + refractOffset * 1.0, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv + refractOffset * 0.8, 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// Surface tension highlights - bright spots like on water
float surfaceTension(vec2 uv, float time) {
    float highlight1 = fbm(uv * 6.0 + time * 0.3);
    float highlight2 = fbm(uv * 8.0 - time * 0.25 + 20.0);

    float tension = pow(highlight1 * highlight2, 3.0) * 0.15;

    return tension;
}

// Caustics - light patterns through water
float caustics(vec2 uv, float time) {
    vec2 p = uv * 8.0;

    float c1 = noise(p + time * 0.5);
    float c2 = noise(p * 1.3 - time * 0.4 + 10.0);

    float caustic = pow(c1 * c2, 2.0) * 0.3;

    return caustic;
}

// Depth tint - darker at edges, lighter in center
vec3 depthTint(vec3 color, vec2 uv) {
    vec2 center = abs(uv - 0.5);
    float depth = length(center);

    // Blue-green tint like water
    vec3 waterTint = vec3(0.7, 0.9, 1.0);
    color = mix(color, color * waterTint, depth * 0.3);

    return color;
}

// Bubble effect - occasional bright spots
float bubbles(vec2 uv, float time) {
    float bubbleTime = floor(time * 2.0);

    // Multiple bubble positions
    for(float i = 0.0; i < 3.0; i++) {
        vec2 bubblePos = vec2(
            fract(sin((bubbleTime + i) * 12.9898) * 43758.5453),
            fract(cos((bubbleTime + i) * 78.233) * 43758.5453)
        );

        // Rising bubbles
        bubblePos.y = fract(bubblePos.y + (time - bubbleTime) * 0.3);

        float dist = length(uv - bubblePos);
        float bubble = smoothstep(0.02, 0.01, dist) * 0.2;

        if (bubble > 0.0) return bubble;
    }

    return 0.0;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply liquid flow
    uv += liquidFlow(uv, time);

    // Apply ripples
    uv += ripple(uv, time);

    // Apply waves
    uv += waves(uv, time);

    // Apply swirl
    uv += swirl(uv, time);

    // Apply viscosity
    uv += viscosity(uv, time);

    // Clamp UV
    uv = clamp(uv, 0.0, 1.0);

    // Get color with refraction
    vec4 color = liquidRefraction(uv, time);

    // Apply depth tint
    color.rgb = depthTint(color.rgb, v_texcoord);

    // Add surface tension highlights
    float tension = surfaceTension(v_texcoord, time);
    color.rgb += vec3(tension);

    // Add caustics (light patterns)
    float caustic = caustics(v_texcoord, time);
    color.rgb += vec3(caustic * 0.8, caustic, caustic * 0.6);

    // Add bubbles
    float bubble = bubbles(v_texcoord, time);
    color.rgb += vec3(bubble);

    // Subtle shimmer
    float shimmer = noise(v_texcoord * 20.0 + time * 2.0) * 0.03;
    color.rgb += vec3(shimmer);

    // Overall brightness adjustment (water is slightly darker)
    color.rgb *= 0.95;

    fragColor = color;
}
