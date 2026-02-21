# Base16 Color Schemes

Aether supports importing [Base16](https://github.com/chriskempson/base16) color schemes, a popular format for terminal and editor themes.

## What is Base16?

Base16 is a standardized color scheme format that defines 16 colors for consistent theming across applications. Each color has a specific semantic meaning:

| Color | Purpose |
|-------|---------|
| base00 | Default Background |
| base01 | Lighter Background (status bars) |
| base02 | Selection Background |
| base03 | Comments, Invisibles |
| base04 | Dark Foreground |
| base05 | Default Foreground |
| base06 | Light Foreground |
| base07 | Light Background |
| base08 | Red (variables, errors) |
| base09 | Orange (integers, constants) |
| base0A | Yellow (classes, search) |
| base0B | Green (strings) |
| base0C | Cyan (regex, escapes) |
| base0D | Blue (functions) |
| base0E | Magenta (keywords) |
| base0F | Brown (deprecated) |

## Importing Base16 Schemes

### Via GUI

1. In the **Color Palette** section, click the import button (document icon)
2. Select **Base16 (.yaml)** from the dropdown
3. Choose your `.yaml` or `.yml` file
4. The colors are automatically mapped and applied

### Via CLI

```bash
# Import and apply Base16 scheme
aether --import-base16 /path/to/scheme.yaml

# With optional wallpaper
aether --import-base16 /path/to/scheme.yaml --wallpaper ~/wallpaper.jpg

# Light mode variant
aether --import-base16 /path/to/scheme.yaml --light-mode
```

## File Format

Base16 schemes use a simple YAML format:

```yaml
scheme: "Dracula"
author: "Jamy Golden (http://github.com/jamygolden)"
base00: "282a36"
base01: "44475a"
base02: "44475a"
base03: "6272a4"
base04: "bd93f9"
base05: "f8f8f2"
base06: "f8f8f2"
base07: "ffffff"
base08: "ff5555"
base09: "ffb86c"
base0A: "f1fa8c"
base0B: "50fa7b"
base0C: "8be9fd"
base0D: "bd93f9"
base0E: "ff79c6"
base0F: "00f769"
```

**Supported features:**
- Colors with or without `#` prefix
- Single and double quoted values
- Inline comments (`base00: "282a36" # background`)
- Full-line comments

## Color Mapping

Aether maps Base16 colors to ANSI terminal colors following the [base16-shell](https://github.com/chriskempson/base16-shell) standard:

| ANSI Color | Base16 Source |
|------------|---------------|
| 0 (Black) | base00 |
| 1 (Red) | base08 |
| 2 (Green) | base0B |
| 3 (Yellow) | base0A |
| 4 (Blue) | base0D |
| 5 (Magenta) | base0E |
| 6 (Cyan) | base0C |
| 7 (White) | base05 |
| 8 (Bright Black) | base03 |
| 9 (Bright Red) | base08 |
| 10 (Bright Green) | base0B |
| 11 (Bright Yellow) | base0A |
| 12 (Bright Blue) | base0D |
| 13 (Bright Magenta) | base0E |
| 14 (Bright Cyan) | base0C |
| 15 (Bright White) | base07 |

### Extended Colors

When importing a Base16 scheme, Aether automatically derives extended colors from the palette:

| Extended Color | Derived From |
|----------------|--------------|
| `accent` | color4 (Blue) |
| `cursor` | color7 (White / Default Foreground) |
| `selection_foreground` | color0 (Black/Background) |
| `selection_background` | color7 (White / Default Foreground) |

These extended colors can be manually adjusted after import in the Extended Colors section.

## Finding Base16 Schemes

Popular repositories with Base16 schemes:

- [tinted-theming/base16-schemes](https://github.com/tinted-theming/base16-schemes) — Official scheme collection
- [base16-schemes-source](https://github.com/chriskempson/base16-schemes-source/blob/main/list.yaml) — Original scheme list
- [tinted-theming/schemes](https://github.com/tinted-theming/schemes) — 250+ schemes
- [base16-gallery](https://tinted-theming.github.io/tinted-gallery/) — Visual browser
- [terminal.sexy](https://terminal.sexy/) — Export as Base16

## Example Schemes

### Gruvbox Dark

```yaml
scheme: "Gruvbox dark, hard"
author: "Dawid Kurek (dawikur@gmail.com)"
base00: "1d2021"
base01: "3c3836"
base02: "504945"
base03: "665c54"
base04: "bdae93"
base05: "d5c4a1"
base06: "ebdbb2"
base07: "fbf1c7"
base08: "fb4934"
base09: "fe8019"
base0A: "fabd2f"
base0B: "b8bb26"
base0C: "8ec07c"
base0D: "83a598"
base0E: "d3869b"
base0F: "d65d0e"
```

### Nord

```yaml
scheme: "Nord"
author: "arcticicestudio"
base00: "2E3440"
base01: "3B4252"
base02: "434C5E"
base03: "4C566A"
base04: "D8DEE9"
base05: "E5E9F0"
base06: "ECEFF4"
base07: "8FBCBB"
base08: "BF616A"
base09: "D08770"
base0A: "EBCB8B"
base0B: "A3BE8C"
base0C: "88C0D0"
base0D: "81A1C1"
base0E: "B48EAD"
base0F: "5E81AC"
```

## Troubleshooting

**"Missing Base16 colors" error**

Ensure your YAML file contains all 16 base colors (base00 through base0F).

**Colors look wrong**

Base16 uses semantic color assignments that may differ from direct 1:1 mappings. The bright colors (8-15) intentionally reuse some accent colors for consistency.

**File not recognized**

Make sure the file extension is `.yaml` or `.yml` and follows the Base16 format with `baseXX` keys.
