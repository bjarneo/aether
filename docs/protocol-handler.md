# Register the aether:// protocol

Use `aether://` links to open a theme, palette, or wallpaper in Aether directly from a browser.

## Quick start

Packages that include `li.oever.aether.url-handler.desktop` make the handler available to the desktop environment. Verify it after installing Aether:

```bash
xdg-mime query default x-scheme-handler/aether
```

The expected result is:

```text
li.oever.aether.url-handler.desktop
```

If the command prints nothing, register the handler for the current user:

```bash
mkdir -p ~/.local/share/applications
install -m 644 li.oever.aether.url-handler.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications
xdg-mime default li.oever.aether.url-handler.desktop x-scheme-handler/aether
```

Run those commands from the Aether source checkout. `make install` already performs these steps.

## Package releases

Linux packages must install the handler desktop file at:

```text
/usr/share/applications/li.oever.aether.url-handler.desktop
```

The file declares `MimeType=x-scheme-handler/aether;` and invokes:

```text
aether --handle-url %u
```

After installing a new package, users can set it as their default handler with:

```bash
xdg-mime default li.oever.aether.url-handler.desktop x-scheme-handler/aether
```

## Troubleshooting

If the handler is installed but links still do not open, rerun the desktop database update and default-association command above. Some browsers cache protocol-handler choices, so restart the browser after changing the association. See [Web Handler](web-handler.md) for supported link parameters and security guidance.
