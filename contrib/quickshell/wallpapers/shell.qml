import QtQuick
import Quickshell
import Quickshell.Wayland

Item {
    id: root

    property var shell: null
    property var manifest: null
    property bool opened: false

    readonly property string pluginId: manifest && manifest.id
        ? String(manifest.id)
        : "aether.wallpapers"

    function open(payloadJson) {
        root.opened = true
		picker.beginSession()
        Qt.callLater(function () { picker.forceActiveFocus() })
    }

    function close() {
        root.opened = false
    }

    function dismiss() {
        root.close()
        if (root.shell && typeof root.shell.hide === "function")
            root.shell.hide(root.pluginId)
    }

    PanelWindow {
        anchors {
            top: true
            bottom: true
            left: true
            right: true
        }
        visible: root.opened
        color: "transparent"
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: root.opened
            ? WlrKeyboardFocus.Exclusive
            : WlrKeyboardFocus.None
        WlrLayershell.namespace: "aether-slider"

        WallpaperSlider {
            id: picker
            anchors.fill: parent
            focus: root.opened
            onDismissRequested: root.dismiss()
        }
    }
}
