# aether:// web handler

Apply themes, color schemes, and wallpapers in Aether with a single click from any web page.

## URL scheme

Aether registers as the handler for `x-scheme-handler/aether` on install. One action is supported: `apply`.

```
aether://apply?<param>=<https-url>[&<param>=<https-url>...]
```

| Parameter | Value | Effect |
| --- | --- | --- |
| `external_theme` | URL to a theme JSON | Loads the palette and extended colors from a full Aether blueprint |
| `colors` | URL to a `colors.toml` | Loads the 16-color palette verbatim, no extraction |
| `wallpaper` | URL to an image | Sets the wallpaper (no re-extraction, even when used alone) |
| `mode` | `light` or `dark` | Forces Aether into light or dark mode before applying. Omit to fall back to the colors.toml's own `mode = "..."` field, then to the current setting. |
| `silent` | `true` | Skips the confirm dialog and applies immediately. Use with care: any web page can construct this URL. |
| `as_omarchy_theme` | theme name | Installs into `~/.config/omarchy/themes/<name>/` and runs `omarchy-theme-set <name>`. Always silent. Name must match `[A-Za-z0-9][A-Za-z0-9_.-]*`. |

`external_theme` and `colors` are mutually exclusive; `external_theme` wins when both are present. `wallpaper` can be combined with either, or used alone. `mode` and `silent` can be combined with any of the above.

## Examples

Colors + wallpaper:

```
aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg
```

Wallpaper only (keeps the current palette, just changes the background, no color extraction):

```
aether://apply?wallpaper=https://wallhaven.cc/full/85/wallhaven-85oxw9.jpg
```

External theme JSON (a full Aether blueprint):

```
aether://apply?external_theme=https://gist.example.com/raw/my-theme.json
```

Force light mode while applying a palette + wallpaper:

```
aether://apply?colors=https://themes.example.com/solarized/light.toml&wallpaper=https://themes.example.com/solarized/wp.jpg&mode=light
```

Silent apply (no dialog) — for one-click flows where the user has already opted in:

```
aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg&silent=true
```

Install as a named Omarchy theme and activate it:

```
aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg&as_omarchy_theme=nord
```

## HTML button

```html
<a href="aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg">
  Apply in Aether
</a>
```

URL-encode any values containing `&`, `?`, `=`, or spaces.

## What happens on click

1. Browser asks once to allow `aether://` links (browser-dependent).
2. Aether downloads the referenced files into `~/.cache/aether/web-imports/`. Filenames are sha256-hashed, so re-clicking the same link skips re-downloading.
3. A confirmation dialog opens in Aether with a palette preview, wallpaper thumbnail, and the source URL. Nothing is applied until the user clicks Apply. (When the URL has `silent=true`, this step is skipped — see below.)
4. On Apply:
   - The `colors.toml` (or theme JSON) is loaded into the editor as the current palette, verbatim, without running color extraction.
   - The downloaded wallpaper is set as the current wallpaper.
   - The theme is applied to all configured target apps automatically (same as clicking Apply in the editor).
5. The import is **not** saved as a blueprint. The editor state is updated and the theme is written to disk, but the Blueprints library is untouched. Save manually from the editor if you want to keep it.

If Aether is closed when the link is clicked, the launch is automatic and the dialog appears once the GUI is ready.

### `as_omarchy_theme=NAME` — install as an Omarchy theme

Renders the imported palette + wallpaper into `~/.config/omarchy/themes/<name>/` as a real Omarchy theme bundle (colors.toml, backgrounds/, plus all the per-app templates Aether normally writes), then runs `omarchy-theme-set <name>` to activate it. The theme persists in the Omarchy picker and can be re-selected later.

Always silent — installing into the system themes directory is the publisher's consent action. The name is restricted to `[A-Za-z0-9][A-Za-z0-9_.-]*` (max 64 chars) so it can be used as both a filesystem path and an argv argument. Requires `omarchy-theme-set` on PATH; the CLI errors out otherwise.

Wallpaper-only `as_omarchy_theme` installs borrow the currently applied palette from `~/.config/aether/theme/colors.toml` so the rendered bundle isn't blank.

### Light/dark from the colors.toml itself

A published `colors.toml` can declare its own light/dark mode via:

```toml
mode = "light"          # or "dark"
# light_mode = true      # also accepted; false → dark
```

Precedence: URL `mode=` (if set) wins, then the colors.toml's `mode` / `light_mode` field, then the current setting. So a publisher can ship a self-describing light theme and the URL doesn't need to carry `mode=light` to make it stick.

### `silent=true` — apply without confirming

`silent=true` makes the click apply immediately, no dialog. The URL handler runs the apply *itself*, in the same process — same code path as `aether --import-colors-toml URL`. No GUI is launched and no IPC happens; this works identically whether or not the Aether GUI is running. The downloaded files still land in `~/.cache/aether/web-imports/`, but the staging file and confirmation step are skipped.

Wallpaper-only silent links preserve the current palette by reading the existing `colors.toml` on disk. Light/dark mode is controlled by `mode=light|dark`; omit it to default to dark, matching the existing CLI behavior.

The trade-off is real, though: any web page can produce a silent-apply link. Only mark links silent inside flows where the user has already opted in to the theme they're about to install (your own theme gallery, an in-app catalog), and prefer the default interactive flow for third-party content.

## What's not supported

- Other actions. Only `apply` is recognized; `aether://save?...`, `aether://preview?...`, etc. return an error.
- Plain `https://` URLs passed to `--handle-url`. The scheme must be `aether://`. For file imports, use `--import-colors-toml <file>` or the GUI drag-drop.
- Extraction tuning in the URL (`extract_mode=`, adjustments). The published palette is applied as-is — by design, since extraction would defeat the point of publishing a curated palette. (Light/dark mode is settable via `mode=light|dark`; that does not run extraction.)
- `file://` URLs. Local files go through the GUI or the existing `--import-*` CLI commands.

## CLI equivalent

The same handler runs from a script or shell:

```bash
aether --handle-url 'aether://apply?colors=https://…/colors.toml&wallpaper=https://…/wp.jpg'
```

This is what the desktop file calls on the user's behalf when a browser dispatches the link. It goes through the confirm dialog like a browser click.

### Skip the dialog from a script

For shell-driven workflows where you don't want the confirm prompt, the existing import commands now accept URLs directly and apply immediately:

```bash
# colors.toml from a URL, no dialog
aether --import-colors-toml https://themes.example.com/nord/colors.toml

# colors.toml + wallpaper, both from URLs, light mode
aether --import-colors-toml https://themes.example.com/solarized/light.toml \
       --wallpaper https://themes.example.com/solarized/wp.jpg \
       --light-mode

# Base16 scheme from a URL with a remote wallpaper
aether --import-base16 https://raw.githubusercontent.com/base16/scheme/main/nord.yaml \
       --wallpaper https://wallhaven.cc/full/85/wallhaven-85oxw9.jpg
```

URLs and local file paths are interchangeable — either works for the positional argument and for `--wallpaper`.
