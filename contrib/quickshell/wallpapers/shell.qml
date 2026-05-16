// Entry point: run with `qs -p contrib/quickshell/shell.qml`
// or symlink this directory into ~/.config/quickshell/aether/
// and run `qs -c aether`.
//
// Aether wallpaper slider. Mirrors the look of `aether --widget-wallpaper-slider`:
// horizontal carousel of cards sheared -5deg on the X-axis, with the wallpaper
// content inside un-sheared so the image stays upright while the card
// silhouette is a parallelogram.

import Quickshell
import Quickshell.Wayland
import QtQuick

Scope {
    PanelWindow {
        id: panel

        anchors {
            top: true
            bottom: true
            left: true
            right: true
        }

        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
        // Namespace lets Hyprland target this surface with a layerrule, e.g.
        //   layerrule = blur, aether-slider
        //   layerrule = ignorezero, aether-slider
        // so the wallpaper behind the scrim gets a compositor-side blur.
        WlrLayershell.namespace: "aether-slider"

        color: "transparent"

        WallpaperSlider {
            anchors.fill: parent
            focus: true
            Keys.onPressed: (e) => {
                if (e.key === Qt.Key_Escape || e.key === Qt.Key_Q) Qt.quit();
            }
        }
    }
}
