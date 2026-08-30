// Aether blueprint selector for the Omarchy shell overlay.
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
import qs.Commons

Item {
    id: root

    signal dismissRequested()

    readonly property color bg: Color.menu.background
    readonly property color fg: Color.menu.text
    readonly property color dim: Color.muted
    readonly property color accent: Color.accent
    readonly property color selectedFg: Color.menu.selectedText
    readonly property color rowHover: Color.menu.selectedBackground
    readonly property color rowActive: Color.menu.selectedBackground
    readonly property color cardBg: Color.menu.background
    readonly property color panelBg: Color.menu.selectedBackground
    readonly property color cardBorder: Color.menu.border

    property var blueprints: []
    property var filtered: []
    property int currentIndex: 0
    property string searchQuery: ""
    property bool applying: false
    property string statusMsg: ""
	property int sessionId: 0

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
		applyProc.forSession = sessionId;
        applyProc.running = true;
    }

    function refresh() {
        if (!listProc.running) listProc.running = true;
    }

	function beginSession() {
		sessionId++;
		searchQuery = "";
		currentIndex = 0;
		applying = applyProc.running;
		statusMsg = applying ? "Finishing previous apply ..." : "";
		recomputeFiltered();
		refresh();
	}

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
						if (!root.applying) root.statusMsg = "";
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
		property int forSession: 0
        running: false
        command: ["aether", "--apply-blueprint", bpName]
        onExited: (code) => {
            root.applying = false;
			if (applyProc.forSession !== root.sessionId) {
				return;
			}
            if (code === 0) {
				root.statusMsg = "";
                root.dismissRequested();
            } else {
                root.statusMsg = "Apply failed";
            }
        }
    }

    Keys.onPressed: (e) => {
        if (e.key === Qt.Key_Escape || e.key === Qt.Key_Q) {
            e.accepted = true; root.dismissRequested();
        } else if (e.key === Qt.Key_Down) {
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
        color: Color.menu.scrim
    }

    // Centered card containing the list. Fairly opaque so the list reads
    // clearly even on top of a bright/busy blurred wallpaper.
    Rectangle {
        id: card
        anchors.centerIn: parent
        width: 460
        height: Math.min(parent.height - 80, 540)
        color: root.cardBg
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
                color: root.panelBg

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
                            color: bpRow.index === root.currentIndex ? root.selectedFg : root.dim
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
