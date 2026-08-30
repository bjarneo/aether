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
| `silent` | `true` | Applies immediately after validation without opening Aether or showing its confirmation dialog |
| `edit` | `true` | Opens the colors and wallpaper in the Aether editor without applying. Nothing is written to disk until the user clicks Apply. Overrides `as_omarchy_theme`. |
| `as_omarchy_theme` | theme name | After confirmation, installs into `~/.config/omarchy/themes/<name>/` and activates it with `omarchy theme set <name>`. Name must match `[A-Za-z0-9][A-Za-z0-9_.-]*`. |

`external_theme` and `colors` are mutually exclusive; links containing both are rejected. `wallpaper` can be combined with either, or used alone. `edit` takes precedence over `as_omarchy_theme`: if `edit=true` is present, the import opens in the editor instead of installing.

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

Install as a named Omarchy theme and activate it:

```
aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg&as_omarchy_theme=nord
```

Open in the editor to tweak before applying (nothing is written until you click Apply):

```
aether://apply?colors=https://themes.example.com/nord/colors.toml&wallpaper=https://themes.example.com/nord/wp.jpg&edit=true
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
3. Unless `silent=true` is present, a confirmation dialog opens in Aether with a palette preview, wallpaper thumbnail, source URL, and requested Omarchy theme name when present.
4. On confirmation:
   - The `colors.toml` (or theme JSON) is loaded into the editor as the current palette, verbatim, without running color extraction.
   - The downloaded wallpaper is set as the current wallpaper.
   - A normal link applies the theme to all configured target apps (same as clicking Apply in the editor).
   - An `as_omarchy_theme` link creates the named theme and activates it through Omarchy.
5. The import is **not** saved as a blueprint. The editor state is updated and the theme is written to disk, but the Blueprints library is untouched. Save manually from the editor if you want to keep it.

If Aether is closed when the link is clicked, the launch is automatic and the dialog appears once the GUI is ready.

### `as_omarchy_theme=NAME`: install as an Omarchy theme

Renders the imported palette and wallpaper into `~/.config/omarchy/themes/<name>/` as a native Omarchy theme bundle, then runs `omarchy theme set <name>` to activate it. Omarchy generates application configs, performs reloads, and runs hooks. The theme persists in the Omarchy picker and can be selected again later.

The confirmation dialog names the theme and explains that it will be activated. With `silent=true`, installation and activation happen immediately after validation. Existing user and built-in themes are never overwritten or shadowed by a web import. The name is restricted to `[A-Za-z0-9][A-Za-z0-9_.-]*` (max 64 chars) and normalized to lowercase. Requires the public `omarchy` command on `PATH`.

Wallpaper-only `as_omarchy_theme` installs borrow the currently applied palette from `~/.config/aether/theme/colors.toml` so the rendered bundle isn't blank.

### Light/dark from the colors.toml itself

A published `colors.toml` can declare its own light/dark mode via:

```toml
mode = "light"          # or "dark"
# light_mode = true      # also accepted; false → dark
```

Precedence: URL `mode=` (if set) wins, then the colors.toml's `mode` / `light_mode` field, then the current setting. So a publisher can ship a self-describing light theme and the URL doesn't need to carry `mode=light` to make it stick.

### `edit=true` — open in the editor without applying

`edit=true` loads the palette and wallpaper into the Aether editor and switches to the editor tab. Nothing is written to disk, no target apps are touched, and the Omarchy themes directory is untouched. The user reviews the palette in the confirm dialog, clicks "Open in editor", tweaks colors or adjustments, then applies manually when ready.

It wins over `as_omarchy_theme`: a link with both parameters opens in the editor and does not install the named theme. Use it for "customize this theme" buttons where the published palette is a starting point rather than a finished product.

The launch/IPC handoff is the same as the default interactive flow: if the GUI is running it's notified over IPC, otherwise it's launched and picks up the staged import on startup.

### `silent=true` - apply without opening Aether

`silent=true` runs the requested apply directly in the URL-handler process after all URL, size, image, and color validation succeeds. Combining it with `as_omarchy_theme` creates and activates the named Omarchy theme without launching the GUI. `edit=true` takes precedence and still opens the editor.

Any web page can construct an `aether://` link. Use silent links only where clicking the link itself is an explicit apply or install action. The browser may show its own external-protocol prompt, but Aether does not add another confirmation.

## What's not supported

- Other actions. Only `apply` is recognized; `aether://save?...`, `aether://preview?...`, etc. return an error.
- Plain `https://` URLs passed to `--handle-url`. The scheme must be `aether://`. For file imports, use `--import-colors-toml <file>` or the GUI drag-drop.
- HTTP, loopback, private-network, link-local, and credential-bearing asset URLs. Remote assets must use HTTPS on a public host.
- Extraction tuning in the URL (`extract_mode=`, adjustments). The published palette is applied as-is — by design, since extraction would defeat the point of publishing a curated palette. (Light/dark mode is settable via `mode=light|dark`; that does not run extraction.)
- `file://` URLs. Local files go through the GUI or the existing `--import-*` CLI commands.

Remote palette and blueprint files are limited to 1 MiB. Wallpapers are limited to 50 MiB and must contain a supported image no larger than 16,384 pixels on either side or 40 million total pixels. Imported palette values must be three- or six-digit hex colors.

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

HTTPS URLs and local file paths are interchangeable — either works for the positional argument and for `--wallpaper`.
