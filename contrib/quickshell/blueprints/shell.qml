// Entry point: run with `qs -p contrib/quickshell/blueprints/shell.qml`
// or symlink this directory into ~/.config/quickshell/aether-blueprints/
// and run `qs -c aether-blueprints`.
//
// Aether blueprints picker. Fullscreen overlay; centered card lists saved
// blueprints (name + 8-color palette swatch row each). Type to search,
// arrow keys to navigate, Enter to apply via `aether --apply-blueprint`.

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
        WlrLayershell.namespace: "aether-blueprints"

        color: "transparent"

        Blueprints {
            anchors.fill: parent
            focus: true
            Keys.onPressed: (e) => {
                if (e.key === Qt.Key_Escape || e.key === Qt.Key_Q) Qt.quit();
            }
        }
    }
}
