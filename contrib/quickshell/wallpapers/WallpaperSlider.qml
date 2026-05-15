// Aether wallpaper slider, modelled after the Wails `--widget-wallpaper-slider`.
// Horizontal ListView, cards sheared -5deg on the X-axis; each card un-shears
// its image by +5deg (with a 1.15x scale to fill the parallelogram) so
// wallpaper content stays upright while the silhouette leans. Cards farther
// from the active shrink in both width and height for a depth-of-field falloff.
//
// Press Enter to apply the previewed Material-mode theme.
//
// Keyboard:
//   left/right or shift+tab/tab   navigate
//   enter                         apply theme via `aether --generate`
//   ctrl+l                        toggle light mode (re-extracts current)
//   a..z 0..9 ...                 type-to-search (filters by filename)
//   backspace                     edit search
//   esc / q                       dismiss (handled in shell.qml)

import Quickshell
import Quickshell.Io
import QtQuick

Item {
    id: root

    // Skew angle in degrees. Outer card shears by -SKEW; inner image by
    // +SKEW so its content lands back upright.
    readonly property real skew: 5
    readonly property real skewK:  Math.tan( root.skew * Math.PI / 180)
    readonly property real skewKi: Math.tan(-root.skew * Math.PI / 180)

    // Card geometry. Active card is wider and taller; inactive cards
    // shrink the further they are from the active one.
    readonly property int cardW:        100
    readonly property int cardActiveW:  220
    readonly property int cardH:        250
    readonly property int cardActiveH:  280
    readonly property int cardMinW:     48
    readonly property int cardMinH:     150

    property color bg:     "#0d0c0c"
    property color fg:     "#c5c9c5"
    property color dim:    "#7a7a72"
    property color accent: "#658594"

    property var wallpapers: []
    property var filteredIndexes: []
    property string searchQuery: ""
    property int currentIndex: 0

    property bool extracting: false
    property bool applying: false
    property bool lightMode: false
    property var palette: []
    property string statusMsg: ""

    property string pendingExtractPath: ""

    // path -> [16 hex strings]. Subsequent visits to a wallpaper skip
    // the aether subprocess. Cleared on light-mode toggle.
    property var paletteCache: ({})

    function effectiveCount() {
        return searchQuery ? filteredIndexes.length : wallpapers.length;
    }

    function effectiveItem(i) {
        if (i < 0) return null;
        if (searchQuery) {
            const idx = filteredIndexes[i];
            return idx === undefined ? null : wallpapers[idx];
        }
        return wallpapers[i] ?? null;
    }

    function currentItem() {
        return effectiveItem(currentIndex);
    }

    function pickInitialIndex() {
        const prefixes = ["0-", "1-", "2-"];
        for (let p = 0; p < prefixes.length; ++p) {
            for (let i = 0; i < wallpapers.length; ++i) {
                if (wallpapers[i].name.startsWith(prefixes[p])) return i;
            }
        }
        return 0;
    }

    function move(delta) {
        const count = effectiveCount();
        if (!count) return;
        currentIndex = Math.max(0, Math.min(count - 1, currentIndex + delta));
        extractTimer.restart();
    }

    function applyCurrent() {
        const item = currentItem();
        if (!item || applying) return;
        applying = true;
        statusMsg = "Applying " + item.name;
        applyProc.forPath = item.path;
        applyProc.running = true;
    }

    function applySearchFilter() {
        if (!searchQuery) {
            filteredIndexes = [];
            currentIndex = 0;
            extractTimer.restart();
            return;
        }
        const q = searchQuery.toLowerCase();
        const out = [];
        for (let i = 0; i < wallpapers.length; ++i) {
            if (wallpapers[i].name.toLowerCase().includes(q)) out.push(i);
        }
        filteredIndexes = out;
        currentIndex = 0;
        if (out.length) extractTimer.restart();
    }

    function _applyPalette(colors) {
        root.palette = colors.slice(0, 16);
        root.accent  = colors[4];
        // In light mode the extracted palette's bg/fg/dim are bright, which
        // would wash out the scrim and kill the compositor blur effect. Keep
        // the chrome dark always; the palette strip still shows the real
        // light colors so you can see what you're about to apply.
        if (!root.lightMode) {
            root.bg  = colors[0];
            root.fg  = colors[7];
            root.dim = colors[8];
        }
    }

    function _drainPending(justFinishedPath) {
        if (root.pendingExtractPath && root.pendingExtractPath !== justFinishedPath) {
            const next = root.pendingExtractPath;
            root.pendingExtractPath = "";
            Qt.callLater(() => root._startExtract(next));
        } else {
            root.pendingExtractPath = "";
        }
    }

    function _startExtract(path) {
        const cached = root.paletteCache[path];
        if (cached) {
            root._applyPalette(cached);
            root.extracting = false;
            root.statusMsg = "";
            root._drainPending(path);
            return;
        }
        root.extracting = true;
        root.statusMsg = "";
        extractProc.forPath = path;
        extractProc.running = true;
    }

    function _toggleLight() {
        root.lightMode = !root.lightMode;
        root.paletteCache = ({});
        if (root.lightMode) {
            // Force chrome back to dark defaults; subsequent extracts will
            // skip overwriting them while lightMode is true.
            root.bg  = "#0d0c0c";
            root.fg  = "#c5c9c5";
            root.dim = "#7a7a72";
        }
        root.statusMsg = root.lightMode ? "light mode" : "dark mode";
        extractTimer.restart();
    }

    Component.onCompleted: listProc.running = true

    // --- Subprocesses --------------------------------------------------------

    Process {
        id: listProc
        // --with-previews ensures every wallpaper has an 800 px PNG cached
        // at ~/.cache/aether/thumbnails. The Image elements then load those
        // tiny pre-scaled files instead of decoding the full wallpapers,
        // so cards appear sharp in one step with no decode flash.
        command: ["aether", "--list-wallpapers", "--json", "--with-previews"]
        stdout: StdioCollector {
            onStreamFinished: {
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data.wallpapers)) {
                        root.wallpapers = data.wallpapers.filter(w => w && w.size > 0);
                        root.currentIndex = root.pickInitialIndex();
                        extractTimer.restart();
                    } else {
                        root.statusMsg = "No wallpapers found";
                    }
                } catch (e) {
                    root.statusMsg = "aether --list-wallpapers failed";
                    console.warn("list parse:", e);
                }
            }
        }
    }

    Process {
        id: extractProc
        property string forPath: ""
        running: false
        command: {
            const cmd = ["aether", "--extract-palette", forPath,
                         "--extract-mode", "material"];
            if (root.lightMode) cmd.push("--light-mode");
            cmd.push("--json");
            return cmd;
        }
        stdout: StdioCollector {
            onStreamFinished: {
                root.extracting = false;
                const t = text;
                if (t && t.trim().length > 0) {
                    try {
                        const data = JSON.parse(t);
                        if (Array.isArray(data.colors) && data.colors.length >= 16) {
                            const sliced = data.colors.slice(0, 16);
                            root.paletteCache[extractProc.forPath] = sliced;
                            root._applyPalette(sliced);
                            root.statusMsg = "";
                        } else if (data.error) {
                            root.statusMsg = String(data.error);
                        }
                    } catch (e) {
                        console.warn("extract parse:", e);
                    }
                }
                root._drainPending(extractProc.forPath);
            }
        }
    }

    Process {
        id: applyProc
        property string forPath: ""
        running: false
        command: {
            const cmd = ["aether", "--generate", forPath,
                         "--extract-mode", "material"];
            if (root.lightMode) cmd.push("--light-mode");
            return cmd;
        }
        onExited: (code) => {
            root.applying = false;
            root.statusMsg = code === 0 ? "Applied" : "Apply failed";
        }
    }

    Timer {
        id: extractTimer
        interval: 200
        repeat: false
        onTriggered: {
            const item = root.currentItem();
            if (!item) return;
            if (extractProc.running) {
                root.pendingExtractPath = item.path;
                return;
            }
            root._startExtract(item.path);
        }
    }

    // --- Keyboard ------------------------------------------------------------

    Keys.onPressed: (e) => {
        if (e.key === Qt.Key_Right) {
            e.accepted = true; root.move(1);
        } else if (e.key === Qt.Key_Left) {
            e.accepted = true; root.move(-1);
        } else if (e.key === Qt.Key_Tab) {
            e.accepted = true;
            root.move((e.modifiers & Qt.ShiftModifier) ? -1 : 1);
        } else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
            e.accepted = true; root.applyCurrent();
        } else if (e.key === Qt.Key_L && (e.modifiers & Qt.ControlModifier)) {
            e.accepted = true; root._toggleLight();
        } else if (e.key === Qt.Key_Backspace) {
            e.accepted = true;
            if (root.searchQuery.length > 0) {
                root.searchQuery = root.searchQuery.slice(0, -1);
                root.applySearchFilter();
            }
        } else if (
            e.text && e.text.length === 1 &&
            !(e.modifiers & (Qt.ControlModifier | Qt.MetaModifier | Qt.AltModifier)) &&
            e.text >= " " && e.text !== "\t"
        ) {
            e.accepted = true;
            root.searchQuery += e.text;
            root.applySearchFilter();
        }
    }

    // --- Visual tree ---------------------------------------------------------

    // Translucent scrim so the compositor blur (layerrule = blur,
    // aether-slider in Hyprland) reads through. 0.40 alpha keeps the
    // chrome dark enough to be legible but lets the blurred wallpaper
    // show through. Without the layerrule it's just a flat dark tint.
    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(root.bg.r, root.bg.g, root.bg.b, 0.40)
        Behavior on color { ColorAnimation { duration: 300 } }
    }

    // Loading indicator: visible only during the gap between the panel
    // first showing and `aether --list-wallpapers --json` returning.
    Text {
        anchors.centerIn: parent
        visible: root.wallpapers.length === 0 && root.statusMsg === ""
        color: root.dim
        font.family: "monospace"
        font.pixelSize: 12
        text: "loading wallpapers ..."
    }

    // Carousel pushed down so the active card sits in the lower-middle of
    // the screen instead of dead center.
    Column {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter:   parent.verticalCenter
        anchors.verticalCenterOffset: 80
        spacing: 24
        width: parent.width

        Item {
            width: parent.width
            height: root.cardActiveH + 20

            ListView {
                id: carousel
                anchors.fill: parent
                orientation: ListView.Horizontal
                spacing: 0
                interactive: false
                cacheBuffer: 800
                model: root.effectiveCount()
                currentIndex: root.currentIndex

                preferredHighlightBegin: width / 2 - root.cardActiveW / 2
                preferredHighlightEnd:   width / 2 + root.cardActiveW / 2
                highlightRangeMode: ListView.StrictlyEnforceRange
                highlightFollowsCurrentItem: true
                highlightMoveDuration: 220
                highlightMoveVelocity: -1

                delegate: Item {
                    id: cell
                    required property int index
                    readonly property var cellItem: root.effectiveItem(index)
                    readonly property bool active: index === root.currentIndex
                    readonly property int dist: Math.abs(cell.index - root.currentIndex)

                    // Width and height fall off with distance from current,
                    // capped at cardMinW / cardMinH. Each step in either
                    // direction shrinks the card.
                    width: cell.active
                        ? root.cardActiveW
                        : Math.max(root.cardMinW, root.cardW - cell.dist * 12)
                    height: root.cardActiveH

                    Behavior on width { NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }

                    Item {
                        id: skewWrap
                        anchors.centerIn: parent
                        width:  parent.width
                        height: cell.active
                            ? root.cardActiveH
                            : Math.max(root.cardMinH, root.cardH - cell.dist * 22)
                        clip: true

                        Behavior on height { NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }

                        opacity: cell.active
                            ? 1.0
                            : Math.max(0.18, 1.0 - cell.dist * 0.20)
                        Behavior on opacity { NumberAnimation { duration: 160 } }

                        transform: Matrix4x4 {
                            matrix: Qt.matrix4x4(
                                1, root.skewKi, 0, -root.skewKi * skewWrap.height / 2,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1
                            )
                        }

                        Image {
                            id: img
                            anchors.fill: parent
                            source: cell.cellItem
                                ? "file://" + (cell.cellItem.previewPath || cell.cellItem.path)
                                : ""
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                            cache: true
                            // 480 for active (renders ~253 px wide so this
                            // stays crisp on hidpi), 240 for off-active so
                            // even the smallest distant cards look sharp.
                            sourceSize.width: cell.active ? 480 : 240
                            scale: 1.15

                            transform: Matrix4x4 {
                                matrix: Qt.matrix4x4(
                                    1, root.skewK, 0, -root.skewK * img.height / 2,
                                    0, 1, 0, 0,
                                    0, 0, 1, 0,
                                    0, 0, 0, 1
                                )
                            }
                        }

                        Rectangle {
                            anchors.fill: parent
                            color: "transparent"
                            border.color: cell.active ? root.accent : "transparent"
                            border.width: cell.active ? 2 : 0
                            Behavior on border.color { ColorAnimation { duration: 200 } }
                        }

                        Rectangle {
                            anchors.fill: parent
                            visible: cell.active
                            color: "transparent"
                            border.color: Qt.rgba(root.accent.r, root.accent.g, root.accent.b, 0.25)
                            border.width: 8
                            z: -1
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (cell.active) {
                                    root.applyCurrent();
                                } else {
                                    root.currentIndex = cell.index;
                                    extractTimer.restart();
                                }
                            }
                        }
                    }
                }

            }
        }

        Column {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 2

            Row {
                spacing: 2
                Repeater {
                    model: 8
                    Rectangle {
                        width: 34
                        height: 16
                        color: root.palette.length === 16 ? root.palette[index] : "#222"
                    }
                }
            }
            Row {
                spacing: 2
                Repeater {
                    model: 8
                    Rectangle {
                        width: 34
                        height: 16
                        color: root.palette.length === 16 ? root.palette[index + 8] : "#222"
                    }
                }
            }
        }
    }

    Column {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 28
        spacing: 8

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            color: root.dim
            font.family: "monospace"
            font.pixelSize: 10
            text: {
                if (root.statusMsg) return root.statusMsg;
                if (root.applying) return "applying ...";
                if (root.extracting) return "extracting ...";
                const total = root.effectiveCount();
                if (!total) return "no wallpapers";
                const item = root.currentItem();
                const mode = root.lightMode ? "material light" : "material";
                return mode + "  " + (root.currentIndex + 1) + "/" + total +
                       "  " + (item ? item.name : "");
            }
        }

        Rectangle {
            visible: root.searchQuery.length > 0
            anchors.horizontalCenter: parent.horizontalCenter
            color: Qt.rgba(0, 0, 0, 0.5)
            implicitWidth: searchT.implicitWidth + 24
            implicitHeight: searchT.implicitHeight + 8
            Text {
                id: searchT
                anchors.centerIn: parent
                color: root.fg
                font.family: "monospace"
                font.pixelSize: 11
                text: "/ " + root.searchQuery
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            color: root.dim
            font.family: "monospace"
            font.pixelSize: 9
            opacity: 0.55
            text: "left/right navigate   enter apply   ctrl+l light   type to search   esc quit"
        }
    }
}
