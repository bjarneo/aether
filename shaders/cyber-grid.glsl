// CYBER GRID - Tron-style grid
// Animated neon grid lines

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Grid size
    float gridSize = 20.0;
    vec2 grid = fract(v_texcoord * gridSize);
    
    // Animated grid lines
    float lineWidth = 0.05 + 0.02 * sin(time * 1.0);
    float gridLines = step(1.0 - lineWidth, grid.x) + step(1.0 - lineWidth, grid.y);
    
    // Pulsing neon color
    vec3 neonColor = vec3(
        0.0,
        0.5 + 0.5 * sin(time * 1.0),
        1.0
    );
    
    // Add grid
    color.rgb += neonColor * gridLines * 0.4;
    
    // Traveling light
    float travel = fract(time * 0.3);
    float travelLine = smoothstep(travel - 0.02, travel, v_texcoord.y) * 
                       (1.0 - smoothstep(travel, travel + 0.02, v_texcoord.y));
    color.rgb += neonColor * travelLine * 2.0;
    
    fragColor = color;
}
