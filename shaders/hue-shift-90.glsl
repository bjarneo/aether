// HUE SHIFT 90 - Rotate hue by 90 degrees
// Use with: hyprshade on hue-shift-90

#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
out vec4 fragColor;

// RGB to HSL conversion
vec3 rgb2hsl(vec3 color) {
    float maxC = max(max(color.r, color.g), color.b);
    float minC = min(min(color.r, color.g), color.b);
    float delta = maxC - minC;

    float h = 0.0;
    float s = 0.0;
    float l = (maxC + minC) / 2.0;

    if (delta != 0.0) {
        s = l < 0.5 ? delta / (maxC + minC) : delta / (2.0 - maxC - minC);

        if (color.r == maxC) {
            h = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
        } else if (color.g == maxC) {
            h = (color.b - color.r) / delta + 2.0;
        } else {
            h = (color.r - color.g) / delta + 4.0;
        }
        h /= 6.0;
    }

    return vec3(h, s, l);
}

// HSL to RGB conversion
vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    if (s == 0.0) {
        return vec3(l);
    }

    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;

    float r = h + 1.0/3.0;
    float g = h;
    float b = h - 1.0/3.0;

    r = r < 0.0 ? r + 1.0 : (r > 1.0 ? r - 1.0 : r);
    g = g < 0.0 ? g + 1.0 : (g > 1.0 ? g - 1.0 : g);
    b = b < 0.0 ? b + 1.0 : (b > 1.0 ? b - 1.0 : b);

    r = r < 1.0/6.0 ? p + (q - p) * 6.0 * r : (r < 1.0/2.0 ? q : (r < 2.0/3.0 ? p + (q - p) * (2.0/3.0 - r) * 6.0 : p));
    g = g < 1.0/6.0 ? p + (q - p) * 6.0 * g : (g < 1.0/2.0 ? q : (g < 2.0/3.0 ? p + (q - p) * (2.0/3.0 - g) * 6.0 : p));
    b = b < 1.0/6.0 ? p + (q - p) * 6.0 * b : (b < 1.0/2.0 ? q : (b < 2.0/3.0 ? p + (q - p) * (2.0/3.0 - b) * 6.0 : p));

    return vec3(r, g, b);
}

void main() {
    vec4 color = texture(tex, v_texcoord);

    // Convert to HSL
    vec3 hsl = rgb2hsl(color.rgb);

    // Shift hue by 90 degrees (0.25 in normalized range)
    hsl.x = mod(hsl.x + 0.25, 1.0);

    // Convert back to RGB
    color.rgb = hsl2rgb(hsl);

    fragColor = color;
}
