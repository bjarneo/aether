// TEST PASSTHROUGH - Simple texture display for debugging
// Just shows the captured texture with no effects

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    // Sample and display texture directly
    vec4 color = texture(tex, v_texcoord);
    
    // Add a red tint to confirm shader is running
    color.r += 0.1;
    
    fragColor = color;
}
