// INFRARED - Infrared camera style
// Use with: hyprshade on infrared

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Invert green channel (vegetation appears bright in IR)
    float ir = color.g * 1.5;

    // Red-white color map
    vec3 infrared;
    if (ir < 0.5) {
        infrared = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), ir * 2.0);
    } else {
        infrared = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), (ir - 0.5) * 2.0);
    }

    fragColor = vec4(infrared, 1.0);
}
