# Aether Omarchy shell plugins

Native `omarchy-shell` overlays for selecting wallpapers and Aether blueprints. Both use Omarchy shell colors and call the headless `aether` CLI, so the Aether GUI does not need to be open.

## Install

From the repository root:

```bash
make install-omarchy-plugins
```

## Open

```bash
omarchy-shell shell toggle aether.wallpapers '{}'
omarchy-shell shell toggle aether.blueprints '{}'
```

## Validate

```bash
omarchy plugin validate contrib/quickshell/wallpapers
omarchy plugin validate contrib/quickshell/blueprints
qmllint -I /usr/share/omarchy/shell contrib/quickshell/wallpapers/*.qml
qmllint -I /usr/share/omarchy/shell contrib/quickshell/blueprints/*.qml
```

See [the shell plugin guide](../../docs/quickshell.md) for keybinds, controls, and troubleshooting.
