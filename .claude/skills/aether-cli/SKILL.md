---
name: aether-cli
description: >
  Use when the user wants to drive Aether from the command line — generating
  themes from wallpapers, applying or managing blueprints, importing Base16 or
  colors.toml schemes, inspecting the running editor, or scripting palette/
  color operations. Covers both the standalone CLI (works without the GUI) and
  the IPC remote-control commands (require the GUI to be running). Invoke when
  the user mentions `aether --generate`, `aether status`, `aether apply`,
  blueprints from the shell, shell/JSON scripting against Aether, or asks
  "how do I do X from the CLI".
---

# Aether CLI

Aether's CLI has **two operating modes**. Knowing which you need is the entire mental model.

## 1. Standalone (works without GUI)

Flags start with `--`. Read/write files directly, no running process required.

```bash
aether --generate ~/wallpapers/forest.jpg              # extract + apply theme
aether --extract-palette ~/wallpapers/forest.jpg       # extract only, no apply
aether --list-blueprints
aether --apply-blueprint my-theme
aether --color-info '#8b3a62'                          # all reps of a color
aether --contrast '#8b3a62' '#ffffff'                  # WCAG ratio + grade
aether --palette-from-color '#8b3a62'                  # derive 16-color palette
aether --import-base16 ./catppuccin-mocha.yaml
```

Exits 0 on success, 1 on error. Errors go to stderr unless `--json` is set (then `{"error": "..."}` on stdout).

## 2. Remote control (requires running GUI)

Subcommands **without** leading `--`. Talk to the GUI over a Unix socket.

```bash
aether status                    # live editor state — palette, lightMode, mode, wallpaper
aether extract ~/w/forest.jpg    # load wallpaper into the editor
aether set-color 4 '#89b4fa'     # change palette slot 4
aether adjust --vibrance 0.3 --saturation -0.1
aether set-mode pastel
aether apply                     # write theme files and reload apps
aether toggle-light-mode
aether load-blueprint my-theme   # load into editor (does NOT apply)
aether apply-blueprint my-theme  # load AND apply in one step
aether set-wallpaper ~/w/forest.jpg
```

If the GUI isn't running, these fail with a socket error. Launch `aether` first or run the non-dash variants.

**`aether status` returns what the editor currently shows** (as of the state-sync feature) — edits in the GUI propagate to the Go state within ~300ms of the last change. Before that feature, status was stale after GUI edits; don't write scripts assuming the old behavior.

## Extraction modes

The mode controls the palette-generation strategy in `extraction/`. Pass with `--extract-mode` to the standalone commands or `set-mode` via IPC:

- `normal` (default) — dominant-color median-cut
- `monochromatic` — shades/tints of a single hue
- `analogous` — neighbours on the color wheel
- `pastel`, `muted`, `colorful`, `bright`, `material`

List at runtime: `aether --list-modes`.

## JSON for scripting

Append `--json` to most read-oriented standalone commands for stable machine-readable output:

```bash
aether --color-info '#8b3a62' --json
aether --palette-info my-theme --json          # blueprint name or JSON array
aether --list-favorites --json
aether --current-theme --json
```

`--json` is *not* honoured by the IPC remote-control subcommands — those always print a human status block. Parse the output or use `aether --current-theme --json` instead.

## Palette-as-argument

Commands that take "a palette" accept either:
- A blueprint name: `aether --palette-info my-theme`
- A raw JSON array of 16 hex strings: `aether --palette-info '["#000000", ...]'`

## Common one-liners

```bash
# Pick a random wallpaper and theme from it
aether --generate "$(aether --random-wallpaper)"

# Apply every saved blueprint in a rotation (cron)
aether --apply-blueprint "$(aether --list-blueprints --json | jq -r '.[].name' | shuf -n1)"

# Diff current editor palette against a blueprint
diff <(aether status) <(aether --show-blueprint my-theme)
```

## Pitfalls

- **`aether --generate` vs `aether extract`** — the dashed version runs the full extract-and-apply pipeline offline; the undashed one just *loads into the editor* of a running GUI. Easy to confuse.
- **Blueprint name matching is exact.** `aether --show-blueprint my-theme` fails silently with a different message than `my_theme`. Use `aether --list-blueprints` to confirm names.
- **`~/` expansion** is handled by the CLI for path args (`expandHome` in `cli/cli.go`), but only for arguments it knows are paths. Trust the shell to expand it when in doubt.
- **No global config for the CLI.** `--light-mode` and `--extract-mode <mode>` must be passed every invocation; they're not persisted across calls.
- **The Wails GUI writes its own config at `~/.config/aether/`** — the CLI reads from it (for blueprints, favorites) but doesn't mutate it through `--generate`. To change default extraction mode, use the GUI or set it in the appropriate JSON file there.

## Reference

Full exhaustive list: `aether --help`. This skill covers the patterns the help text doesn't — don't re-read `--help` verbatim to the user.

Source of truth: `cli/cli.go` (dispatch), `cli/ipc_commands.go` (remote-control), `cli/output.go` (JSON + palette-name parsing).
