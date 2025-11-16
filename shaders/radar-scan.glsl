// RADAR SCAN - Rotating radar sweep
// Animated circular scan effect

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Center point
    vec2 center = vec2(0.5, 0.5);
    vec2 toCenter = v_texcoord - center;
    
    // Angle and distance
    float angle = atan(toCenter.y, toCenter.x);
    float dist = length(toCenter);
    
    // Rotating scan beam
    float scanAngle = time * 1.0;
    float beam = angle - scanAngle;
    beam = mod(beam + 3.14159, 6.28318) - 3.14159;
    
    // Beam intensity
    float beamIntensity = smoothstep(0.5, 0.0, abs(beam)) * (1.0 - dist * 2.0);
    
    // Green radar color
    vec3 radarColor = vec3(0.0, 1.0, 0.3);
    color.rgb = mix(color.rgb, radarColor, 0.3);
    color.rgb += radarColor * beamIntensity * 0.8;
    
    // Circular grid
    float grid = sin(dist * 50.0) * 0.5 + 0.5;
    color.rgb *= 0.9 + 0.1 * grid;
    
    fragColor = color;
}
