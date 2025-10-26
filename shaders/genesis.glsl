// GENESIS - Sega Genesis / Mega Drive
// Use with: hyprshade on genesis

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

void main() {
    // Genesis resolution (320x224)
    vec2 pixelSize = vec2(1.0 / 320.0, 1.0 / 224.0);
    vec2 pixelCoord = floor(v_texcoord / pixelSize);
    vec2 pixelUV = pixelCoord * pixelSize + pixelSize * 0.5;

    vec4 color = texture(tex, pixelUV);

    // Genesis had 512 colors (9-bit) - posterize to 8 levels
    color.rgb = floor(color.rgb * 8.0) / 8.0;

    // Genesis had darker, more contrasted look
    color.rgb = pow(color.rgb, vec3(1.1));
    color.rgb *= 0.9;

    // Strong scanlines (Genesis had prominent scanlines)
    float scanline = sin(v_texcoord.y * 224.0 * 3.14159) * 0.5 + 0.5;
    color.rgb *= mix(0.85, 1.0, scanline);

    // Composite video color bleeding
    float offset = 0.0012;
    color.r = texture(tex, pixelUV + vec2(offset, 0.0)).r;
    color.b = texture(tex, pixelUV - vec2(offset, 0.0)).b;

    fragColor = color;
}
