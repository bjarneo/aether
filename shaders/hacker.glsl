// HACKER - Remote access visual interference
// Use with: hyprshade on hacker
// Simulates someone remotely controlling your screen with glitches and artifacts

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// Hash functions
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash2d(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash2d2d(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453123);
}

// Matrix rain effect in corners
float matrixRain(vec2 uv, float time) {
    // Only in corners
    vec2 dist = abs(uv - 0.5);
    float corner = step(0.3, max(dist.x, dist.y));

    if (corner < 0.5) return 0.0;

    float col = floor(uv.x * 40.0);
    float speed = hash(col) * 2.0 + 1.0;
    float offset = hash(col + 123.0) * 10.0;

    float y = fract(uv.y - time * 0.3 * speed + offset);
    float char = step(0.95, hash2d(vec2(col, floor((uv.y - time * 0.3 * speed + offset) * 30.0))));
    float intensity = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.9, y);

    return char * intensity * 0.3;
}

// Random terminal text overlay
float terminalText(vec2 uv, float time) {
    vec2 textCoord = vec2(uv.x * 80.0, uv.y * 25.0);
    vec2 textId = floor(textCoord);

    float lineTime = floor(time * 5.0);
    float shouldShow = step(0.85, hash2d(textId + lineTime));

    // Only show text in top-left corner occasionally
    if (uv.x > 0.4 || uv.y > 0.15) return 0.0;
    if (shouldShow < 0.5) return 0.0;

    float charBlock = step(0.7, hash2d(textId + vec2(lineTime, 0.0)));
    return charBlock * 0.4;
}

// Scanning line - like remote desktop refresh
float scanLine(vec2 uv, float time) {
    float scanSpeed = 0.3;
    float scanPos = fract(time * scanSpeed);
    float scanWidth = 0.02;

    float line = smoothstep(scanPos - scanWidth, scanPos, uv.y) *
                 smoothstep(scanPos + scanWidth, scanPos, uv.y);

    return line * 0.3;
}

// Remote access "latency" effect - delayed sections
vec2 latencyDelay(vec2 uv, float time) {
    float blockY = floor(uv.y * 6.0);
    float delayTime = floor(time * 3.0);

    // Random blocks get delayed/frozen
    float isDelayed = step(0.75, hash2d(vec2(blockY, delayTime)));

    if (isDelayed > 0.5) {
        // Freeze this block's time
        float frozenTime = floor(time * 3.0 - 1.0) / 3.0;
        float offset = (hash(blockY + frozenTime) - 0.5) * 0.02;
        uv.x += offset;
    }

    return uv;
}

// Screen tearing - like bandwidth issues
vec2 screenTear(vec2 uv, float time) {
    float tearTime = floor(time * 4.0);
    float shouldTear = step(0.90, hash(tearTime));

    if (shouldTear > 0.5) {
        float tearLine = hash(tearTime + 1.0);
        if (uv.y > tearLine) {
            float offset = (hash(tearTime + 2.0) - 0.5) * 0.1;
            uv.x += offset;
        }
    }

    return uv;
}

// Compression artifacts - JPEG-like blocks
vec3 compressionArtifacts(vec3 color, vec2 uv, float time) {
    float blockSize = 16.0;
    vec2 blockId = floor(uv * blockSize);
    float blockTime = floor(time * 6.0);

    float corrupt = step(0.92, hash2d(blockId + blockTime));

    if (corrupt > 0.5) {
        // Average color in block (fake compression)
        vec3 avgColor = color * (0.8 + hash2d(blockId) * 0.4);
        color = mix(color, avgColor, 0.5);
    }

    return color;
}

// Signal interference bars
float interferenceBar(vec2 uv, float time) {
    float barTime = floor(time * 8.0);
    float shouldShow = step(0.88, hash(barTime));

    if (shouldShow < 0.5) return 0.0;

    float barPos = hash(barTime + 1.0);
    float barWidth = 0.05 + hash(barTime + 2.0) * 0.1;

    float bar = step(barPos - barWidth * 0.5, uv.y) * step(uv.y, barPos + barWidth * 0.5);

    return bar * 0.2;
}

// VNC-style cursor artifact
float remoteCursor(vec2 uv, float time) {
    // Moving cursor position
    vec2 cursorPos = vec2(
        0.3 + sin(time * 1.5) * 0.4,
        0.3 + cos(time * 1.2) * 0.4
    );

    vec2 delta = abs(uv - cursorPos);

    // Cursor shape (arrow-ish)
    float cursor = step(delta.x + delta.y, 0.015);

    // Leave trails occasionally
    float trailTime = floor(time * 10.0);
    vec2 trailPos = vec2(
        0.3 + sin((trailTime / 10.0) * 1.5) * 0.4,
        0.3 + cos((trailTime / 10.0) * 1.2) * 0.4
    );
    vec2 trailDelta = abs(uv - trailPos);
    float trail = step(trailDelta.x + trailDelta.y, 0.015) * 0.3;

    return max(cursor, trail) * 0.5;
}

// Access denied overlay
float deniedOverlay(vec2 uv, float time) {
    float flashTime = floor(time * 2.0);
    float shouldFlash = step(0.95, hash(flashTime));

    if (shouldFlash < 0.5) return 0.0;

    // Center of screen
    vec2 center = abs(uv - 0.5);
    float box = step(max(center.x, center.y), 0.3);

    return box * 0.2;
}

// Chromatic aberration - network lag
vec4 lagChromatic(vec2 uv, float time) {
    float lagTime = floor(time * 5.0);
    float amount = hash(lagTime) * 0.006;

    vec4 color;
    color.r = texture(tex, clamp(uv + vec2(amount, 0.0), 0.0, 1.0)).r;
    color.g = texture(tex, clamp(uv, 0.0, 1.0)).g;
    color.b = texture(tex, clamp(uv - vec2(amount, 0.0), 0.0, 1.0)).b;
    color.a = 1.0;

    return color;
}

// Signal noise
float signalNoise(vec2 uv, float time) {
    return (hash2d(uv * 100.0 + time * 20.0) - 0.5) * 0.05;
}

// "Connection lost" static burst
float staticBurst(vec2 uv, float time) {
    float burstTime = floor(time * 3.0);
    float shouldBurst = step(0.93, hash(burstTime));

    if (shouldBurst < 0.5) return 0.0;

    return (hash2d(uv * 500.0 + time * 100.0) - 0.5) * 0.3;
}

void main() {
    vec2 uv = v_texcoord;

    // Apply screen tear
    uv = screenTear(uv, time);

    // Apply latency delay
    uv = latencyDelay(uv, time);

    // Clamp UV
    uv = clamp(uv, 0.0, 1.0);

    // Get color with chromatic aberration
    vec4 color = lagChromatic(uv, time);

    // Apply compression artifacts
    color.rgb = compressionArtifacts(color.rgb, v_texcoord, time);

    // Add matrix rain effect (green tint)
    float matrix = matrixRain(v_texcoord, time);
    color.rgb += vec3(0.0, matrix, matrix * 0.3);

    // Add terminal text (green)
    float terminal = terminalText(v_texcoord, time);
    color.rgb += vec3(0.0, terminal, terminal * 0.2);

    // Add scanning line
    float scan = scanLine(v_texcoord, time);
    color.rgb += vec3(scan);

    // Add interference bars
    float interference = interferenceBar(v_texcoord, time);
    color.rgb += vec3(interference, interference * 0.5, 0.0);

    // Add remote cursor
    float cursor = remoteCursor(v_texcoord, time);
    color.rgb += vec3(cursor, cursor * 0.3, 0.0);

    // Add "access denied" flash
    float denied = deniedOverlay(v_texcoord, time);
    color.rgb += vec3(denied, 0.0, 0.0);

    // Add signal noise
    float noise = signalNoise(v_texcoord, time);
    color.rgb += vec3(noise);

    // Add static burst
    float burst = staticBurst(v_texcoord, time);
    color.rgb += vec3(burst);

    // Slight green tint (hacker aesthetic)
    color.g *= 1.05;

    // Occasional brightness flicker (connection issues)
    float flickerTime = floor(time * 12.0);
    float flicker = 0.95 + hash(flickerTime) * 0.1;
    color.rgb *= flicker;

    // Scanlines
    float scanline = step(0.5, fract(v_texcoord.y * 400.0));
    color.rgb *= 1.0 - scanline * 0.03;

    fragColor = color;
}
