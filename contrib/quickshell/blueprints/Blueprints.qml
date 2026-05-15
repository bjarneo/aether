// Aether blueprints picker. Replacement for `aether --widget-blueprint`.
//
// Reads `aether --list-blueprints --json`, shows a vertical list of
// (name + 8-color palette swatch row) entries in a centered card, lets the
// user filter by typing and apply via `aether --apply-blueprint <name>`.
// Closes itself on apply.
//
// Keyboard:
//   up/down                       navigate
//   enter                         apply and quit
//   a..z 0..9 ...                 type-to-search
//   backspace                     edit search
//   esc / q                       dismiss

import Quickshell
import Quickshell.Io
import QtQuick

Item {
    id: root

    // Chrome colors. Defaults are a sensible dark theme; the FileView below
    // overrides them from `~/.config/omarchy/current/theme/colors.toml` so
    // the widget always matches the currently-applied Omarchy theme.
    property color bg:     "#0d0c0c"
    property color fg:     "#c5c9c5"
    property color dim:    "#7a7a72"
    property color accent: "#89b4fa"
    readonly property color rowHover:  Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.06)
    readonly property color rowActive: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.12)

    // Slightly off-bg for the card body so it pops on top of the scrim.
    // Direction depends on whether the Omarchy theme is light or dark.
    readonly property color cardBg: {
        const sum = root.bg.r + root.bg.g + root.bg.b;
        return sum > 1.5
            ? Qt.darker(root.bg, 1.08)   // light theme -> card a bit darker
            : Qt.lighter(root.bg, 1.6);  // dark theme  -> card a bit lighter
    }
    readonly property color panelBg:    Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.05)
    readonly property color cardBorder: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.12)

    // Omarchy theme colors are at a known path. The file is rewritten on
    // every theme swap (`rm -rf current/theme && mv next-theme current/theme`)
    // so there's a brief window where it doesn't exist; reloadTimer covers
    // that race without spamming warnings.
    FileView {
        id: themeFile
        path: (Quickshell.env("HOME") || "") + "/.config/omarchy/current/theme/colors.toml"
        watchChanges: true
        printErrors: false
        onFileChanged: reload()
        onLoaded:      root._applyOmarchyTheme(text())
        onLoadFailed:  reloadTimer.restart()
    }
    Timer {
        id: reloadTimer
        interval: 400
        repeat: false
        onTriggered: themeFile.reload()
    }

    function _applyOmarchyTheme(src) {
        if (!src) return;
        const lines = String(src).split("\n");
        const re = /^\s*([A-Za-z0-9_]+)\s*=\s*"?(#?[0-9A-Fa-f]+)"?\s*$/;
        const t = {};
        for (let i = 0; i < lines.length; ++i) {
            const m = lines[i].match(re);
            if (m) t[m[1]] = m[2];
        }
        // Guard each assignment: an unchanged write would still re-trigger
        // every dependent binding (cardBg, panelBg, row colors, ...).
        function setIfChanged(prop, value) {
            if (value && String(root[prop]) !== String(value)) root[prop] = value;
        }
        setIfChanged("bg",     t.background);
        setIfChanged("fg",     t.foreground);
        setIfChanged("accent", t.accent);
        setIfChanged("dim",    t.color8 || Qt.darker(root.fg, 1.7));
    }

    property var blueprints: []
    property var filtered: []
    property int currentIndex: 0
    property string searchQuery: ""
    property bool applying: false
    property string statusMsg: ""

    function recomputeFiltered() {
        if (!searchQuery) {
            filtered = blueprints;
        } else {
            const q = searchQuery.toLowerCase();
            filtered = blueprints.filter(b => b.name.toLowerCase().includes(q));
        }
        if (currentIndex >= filtered.length) currentIndex = Math.max(0, filtered.length - 1);
    }

    function move(delta) {
        if (!filtered.length) return;
        currentIndex = Math.max(0, Math.min(filtered.length - 1, currentIndex + delta));
        list.positionViewAtIndex(currentIndex, ListView.Contain);
    }

    function applyCurrent() {
        const bp = filtered[currentIndex];
        if (!bp || applying) return;
        applying = true;
        statusMsg = "Applying " + bp.name + " ...";
        applyProc.bpName = bp.name;
        applyProc.running = true;
    }

    Component.onCompleted: listProc.running = true

    Process {
        id: listProc
        command: ["aether", "--list-blueprints", "--json"]
        stdout: StdioCollector {
            onStreamFinished: {
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data.blueprints)) {
                        root.blueprints = data.blueprints;
                        root.recomputeFiltered();
                    } else if (data.error) {
                        root.statusMsg = String(data.error);
                    }
                } catch (e) {
                    root.statusMsg = "aether --list-blueprints failed";
                    console.warn("list parse:", e);
                }
            }
        }
    }

    Process {
        id: applyProc
        property string bpName: ""
        running: false
        command: ["aether", "--apply-blueprint", bpName]
        onExited: (code) => {
            if (code === 0) {
                Qt.quit();
            } else {
                root.applying = false;
                root.statusMsg = "Apply failed";
            }
        }
    }

    Keys.onPressed: (e) => {
        if (e.key === Qt.Key_Down) {
            e.accepted = true; root.move(1);
        } else if (e.key === Qt.Key_Up) {
            e.accepted = true; root.move(-1);
        } else if (e.key === Qt.Key_PageDown) {
            e.accepted = true; root.move(8);
        } else if (e.key === Qt.Key_PageUp) {
            e.accepted = true; root.move(-8);
        } else if (e.key === Qt.Key_Home) {
            e.accepted = true; root.currentIndex = 0;
            list.positionViewAtBeginning();
        } else if (e.key === Qt.Key_End) {
            e.accepted = true; root.currentIndex = Math.max(0, root.filtered.length - 1);
            list.positionViewAtEnd();
        } else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
            e.accepted = true; root.applyCurrent();
        } else if (e.key === Qt.Key_Backspace) {
            e.accepted = true;
            if (root.searchQuery.length > 0) {
                root.searchQuery = root.searchQuery.slice(0, -1);
                root.recomputeFiltered();
            }
        } else if (
            e.text && e.text.length === 1 &&
            !(e.modifiers & (Qt.ControlModifier | Qt.MetaModifier | Qt.AltModifier)) &&
            e.text >= " " && e.text !== "\t"
        ) {
            e.accepted = true;
            root.searchQuery += e.text;
            root.recomputeFiltered();
        }
    }

    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(root.bg.r, root.bg.g, root.bg.b, 0.62)
    }

    // Centered card containing the list. Fairly opaque so the list reads
    // clearly even on top of a bright/busy blurred wallpaper.
    Rectangle {
        id: card
        anchors.centerIn: parent
        width: 460
        height: Math.min(parent.height - 80, 540)
        color: Qt.rgba(root.cardBg.r, root.cardBg.g, root.cardBg.b, 0.94)
        border.color: root.cardBorder
        border.width: 1

        Column {
            anchors.fill: parent
            anchors.margins: 1
            spacing: 0

            // Title bar
            Rectangle {
                width: parent.width
                height: 32
                color: root.panelBg

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.leftMargin: 12
                    text: "BLUEPRINTS"
                    color: root.dim
                    font.family: "monospace"
                    font.pixelSize: 10
                    font.letterSpacing: 1.5
                }

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: 12
                    text: "esc"
                    color: root.dim
                    font.family: "monospace"
                    font.pixelSize: 9
                }
            }

            // Search row -- type to filter; the "/" prefix only appears once
            // the user starts typing.
            Rectangle {
                width: parent.width
                height: 34
                color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.025)

                Text {
                    anchors.fill: parent
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    verticalAlignment: Text.AlignVCenter
                    text: root.searchQuery.length > 0
                        ? "/ " + root.searchQuery
                        : "type to search ..."
                    color: root.searchQuery.length > 0 ? root.fg : root.dim
                    font.family: "monospace"
                    font.pixelSize: 11
                    opacity: root.searchQuery.length > 0 ? 1.0 : 0.5
                }
            }

            // List
            ListView {
                id: list
                width: parent.width
                height: parent.height - 32 - 34 - 26 // title + search + footer
                model: root.filtered
                clip: true
                interactive: false
                currentIndex: root.currentIndex
                highlightFollowsCurrentItem: true
                highlightMoveDuration: 80
                highlightMoveVelocity: -1
                boundsBehavior: Flickable.StopAtBounds

                delegate: Rectangle {
                    id: bpRow
                    required property var modelData
                    required property int index
                    readonly property var bpColors: modelData && modelData.colors
                        ? modelData.colors
                        : []
                    width: list.width
                    height: 28
                    color: index === root.currentIndex
                        ? root.rowActive
                        : (hover.hovered ? root.rowHover : "transparent")

                    HoverHandler { id: hover }

                    Row {
                        anchors.fill: parent
                        anchors.leftMargin: 12
                        anchors.rightMargin: 12
                        spacing: 10

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            width: parent.width - 124 - parent.spacing
                            elide: Text.ElideRight
                            text: bpRow.modelData ? bpRow.modelData.name : ""
                            color: bpRow.index === root.currentIndex ? root.fg : root.dim
                            font.family: "monospace"
                            font.pixelSize: 11
                        }

                        // 8 swatches (first half of the palette). 14px each
                        // x 8 = 112; with 1px gaps that's roughly 124 wide.
                        // Use bpRow.bpColors so the inner Repeater's `index`
                        // doesn't shadow the row's `modelData` lookup.
                        Row {
                            anchors.verticalCenter: parent.verticalCenter
                            spacing: 1
                            Repeater {
                                model: 8
                                Rectangle {
                                    required property int index
                                    width: 14
                                    height: 14
                                    color: bpRow.bpColors.length > index
                                        ? bpRow.bpColors[index]
                                        : "#222"
                                }
                            }
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (root.currentIndex === index) {
                                root.applyCurrent();
                            } else {
                                root.currentIndex = index;
                            }
                        }
                        onDoubleClicked: {
                            root.currentIndex = index;
                            root.applyCurrent();
                        }
                    }
                }

            }

            // Footer / status
            Rectangle {
                width: parent.width
                height: 26
                color: root.panelBg

                Text {
                    anchors.fill: parent
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    verticalAlignment: Text.AlignVCenter
                    color: root.dim
                    font.family: "monospace"
                    font.pixelSize: 9
                    text: {
                        if (root.statusMsg) return root.statusMsg;
                        if (root.applying) return "applying ...";
                        const total = root.filtered.length;
                        if (root.blueprints.length === 0) return "loading ...";
                        if (total === 0) return "no matches";
                        return (root.currentIndex + 1) + "/" + total +
                               "   up/down nav   enter apply";
                    }
                }
            }
        }
    }
}
