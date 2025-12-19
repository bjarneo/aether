# Screen Shaders

Aether includes 80+ GLSL screen shaders for hyprshade.

## Location

Shaders are installed to `~/.config/hypr/shaders/` on first run.

## Using Shaders

### Via Aether UI

Open Settings sidebar → Shader Manager → Toggle any shader.

### Via Hyprland Keybinds

```conf
# ~/.config/hypr/hyprland.conf
bind = $mainMod, F1, exec, hyprshade toggle grayscale
bind = $mainMod, F2, exec, hyprshade toggle retro-glow
bind = $mainMod, F3, exec, hyprshade off
```

## Shader Categories

| Category | Examples |
|----------|----------|
| Color | grayscale, sepia, duotone, tritone |
| Temperature | warm-tone, cool-tone, blue-light-reduce |
| Saturation | saturate, desaturate, color-pop, pastel |
| Era Vibes | 40s, 50s, 60s, 70s, 80s, 90s, 00s |
| Artistic | golden-hour, cyberpunk-neon, vintage-film |
| Nature | forest-green, ocean, arctic-blue, autumn-leaves |
| Accessibility | protanopia, deuteranopia, high-contrast |

## Adding Custom Shaders

Drop `.glsl` files in `~/.config/hypr/shaders/`. They appear in Shader Manager automatically.

## Resources

- [The Book of Shaders](https://thebookofshaders.com/)
- [Shadertoy](https://www.shadertoy.com/)
- [LearnOpenGL - Shaders](https://learnopengl.com/Getting-started/Shaders)
