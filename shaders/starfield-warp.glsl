// STARFIELD WARP - Star Wars hyperspace jump effect
// Stars stretching into light streaks

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 color = texture(tex, v_texcoord);
    
    // Center point for warp
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = v_texcoord - center;
    float dist = length(dir);
    vec2 normDir = normalize(dir);
    
    // Star field
    float stars = 0.0;
    for(float i = 0.0; i < 100.0; i++) {
        vec2 starPos = vec2(
            random(vec2(i, 0.0)) - 0.5,
            random(vec2(i, 1.0)) - 0.5
        );
        
        float starDist = length(starPos);
        float speed = 0.5 + random(vec2(i, 2.0)) * 0.5;
        
        // Warp speed animation
        float warpTime = mod(time * speed, 2.0);
        vec2 warpedPos = starPos + normalize(starPos) * warpTime * 0.3;
        
        // Star streak
        float streak = 0.0;
        vec2 toStar = v_texcoord - center - warpedPos;
        float alongStreak = dot(toStar, normalize(starPos));
        float perpStreak = length(toStar - alongStreak * normalize(starPos));
        
        if (alongStreak > 0.0 && alongStreak < warpTime * 0.3) {
            streak = smoothstep(0.005, 0.0, perpStreak) * (1.0 - alongStreak / (warpTime * 0.3));
        }
        
        // Star point
        float starDot = smoothstep(0.01, 0.0, length(v_texcoord - center - warpedPos));
        
        stars += (starDot + streak) * 0.3;
    }
    
    // Add blue/white warp color
    vec3 warpColor = vec3(0.7, 0.9, 1.0);
    color.rgb += warpColor * stars;
    
    // Radial blur
    float blur = dist * 0.1;
    color.rgb += vec3(blur * 0.2);
    
    // Speed lines
    float speedLine = abs(sin(atan(dir.y, dir.x) * 20.0));
    speedLine *= smoothstep(0.3, 0.5, dist);
    color.rgb += warpColor * speedLine * 0.1;
    
    fragColor = color;
}
