// TRON GRID - Digital grid from TRON with cyan/orange lines
// Animated perspective grid with pulsing energy

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Create perspective grid
    vec2 gridUV = v_texcoord;
    gridUV.y = 1.0 - pow(1.0 - gridUV.y, 2.0); // Perspective warp
    
    // Grid lines
    float gridSize = 20.0;
    vec2 grid = fract(gridUV * gridSize + time * 0.5);
    
    float lineWidth = 0.05;
    float gridX = smoothstep(lineWidth, 0.0, grid.x) + 
                  smoothstep(1.0 - lineWidth, 1.0, grid.x);
    float gridY = smoothstep(lineWidth, 0.0, grid.y) + 
                  smoothstep(1.0 - lineWidth, 1.0, grid.y);
    
    float gridPattern = max(gridX, gridY);
    
    // TRON colors - cyan and orange
    vec3 tronCyan = vec3(0.0, 1.0, 1.0);
    vec3 tronOrange = vec3(1.0, 0.5, 0.0);
    
    // Pulse along grid
    float pulse = sin(gridUV.y * 5.0 - time * 2.0) * 0.5 + 0.5;
    vec3 gridColor = mix(tronCyan, tronOrange, pulse);
    
    // Apply grid
    color.rgb += gridColor * gridPattern * 0.4;
    
    // Scan line moving across
    float scanLine = abs(sin((v_texcoord.y - time * 0.2) * 3.14159));
    scanLine = smoothstep(0.9, 1.0, scanLine);
    color.rgb += tronCyan * scanLine * 0.5;
    
    // Digital glow
    color.rgb += gridColor * 0.1;
    
    // Darken overall for contrast
    color.rgb *= 0.9;
    
    fragColor = color;
}
