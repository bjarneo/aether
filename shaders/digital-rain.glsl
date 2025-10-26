// DIGITAL RAIN - The Matrix falling code effect
// Use with: hyprshade on digital-rain

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

// Generate random character
float randomChar(vec2 pos) {
    return hash(pos.x * 12.9898 + pos.y * 78.233);
}

// Draw character at position
float drawChar(vec2 uv, vec2 cellPos, float charValue) {
    vec2 localUV = fract(uv);

    // Simple character representation (5x7 grid)
    vec2 charGrid = floor(localUV * vec2(5.0, 7.0));
    float charHash = hash(charValue * 100.0 + charGrid.x + charGrid.y * 5.0);

    return step(0.5, charHash);
}

void main() {
    vec4 screenColor = texture(tex, v_texcoord);

    // Grid setup
    vec2 gridSize = vec2(80.0, 50.0);
    vec2 cell = floor(v_texcoord * gridSize);

    // Each column has different speed
    float columnSpeed = 0.3 + hash(cell.x) * 0.5;

    // Rain position for this column
    float rainPos = fract(time * columnSpeed + hash(cell.x));

    // Convert to cell Y position
    float cellY = rainPos * gridSize.y;

    // Distance from rain head
    float distFromHead = cell.y - cellY;

    // Trail length
    float trailLength = 15.0;

    // Only draw if within trail
    if (distFromHead >= -trailLength && distFromHead <= 0.0) {
        // Character value
        float charVal = randomChar(cell + floor(time * columnSpeed * 10.0));

        // Draw character
        float char = drawChar(v_texcoord * gridSize, cell, charVal);

        if (char > 0.5) {
            // Brightness based on position in trail
            float brightness;
            if (distFromHead > -1.0) {
                // Head is bright white
                brightness = 1.0;
            } else {
                // Trail fades
                brightness = 1.0 - abs(distFromHead) / trailLength;
                brightness = pow(brightness, 2.0);
            }

            // Color: white at head, green in trail
            vec3 color;
            if (distFromHead > -1.0) {
                color = vec3(0.9, 1.0, 0.9);
            } else {
                color = vec3(0.0, 1.0, 0.0);
            }

            screenColor.rgb = mix(screenColor.rgb, color, brightness * 0.8);
        }
    }

    // Dark background tint
    screenColor.rgb *= vec3(0.1, 0.2, 0.1);

    fragColor = screenColor;
}
