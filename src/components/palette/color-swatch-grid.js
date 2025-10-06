import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import { applyCssToWidget, removeAllChildren } from '../../utils/ui-helpers.js';
import { ANSI_COLOR_NAMES, PALETTE_CONFIG, SWATCH_DIMENSIONS } from '../../constants/colors.js';

/**
 * Creates and manages a grid of color swatches
 */
export class ColorSwatchGrid {
    constructor(onSwatchClick) {
        this.onSwatchClick = onSwatchClick;
        this._palette = [];
        this._lockedColors = new Array(16).fill(false); // Track lock state for each color

        this.widget = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 4,
            row_spacing: 4,
            homogeneous: true,
            max_children_per_line: PALETTE_CONFIG.maxChildrenPerLine,
            min_children_per_line: PALETTE_CONFIG.minChildrenPerLine,
            hexpand: true,
        });
    }

    setPalette(colors) {
        this._palette = colors;
        this._render();
    }

    _render() {
        removeAllChildren(this.widget);

        this._palette.forEach((color, index) => {
            const swatch = this._createColorSwatch(color, index);
            this.widget.append(swatch);
        });
    }

    _createColorSwatch(color, index) {
        // Container overlay for color + lock icon
        const overlay = new Gtk.Overlay({
            width_request: SWATCH_DIMENSIONS.default.width,
            height_request: SWATCH_DIMENSIONS.default.height,
        });

        const colorBox = new Gtk.Box({
            width_request: SWATCH_DIMENSIONS.default.width,
            height_request: SWATCH_DIMENSIONS.default.height,
            css_classes: ['color-swatch'],
            tooltip_text: ANSI_COLOR_NAMES[index] || `Color ${index}`,
        });

        const isLocked = this._lockedColors[index];
        const borderStyle = isLocked ? '2px solid alpha(@accent_bg_color, 0.8)' : '1px solid alpha(@borders, 0.5)';

        const css = `
            .color-swatch {
                background-color: ${color};
                border-radius: 0px;
                border: ${borderStyle};
                min-width: ${SWATCH_DIMENSIONS.default.width}px;
                min-height: ${SWATCH_DIMENSIONS.default.height}px;
            }
            .color-swatch:hover {
                border: 2px solid alpha(@borders, 1.0);
            }
        `;

        applyCssToWidget(colorBox, css);
        colorBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

        overlay.set_child(colorBox);

        // Lock icon button overlay
        const lockButton = new Gtk.Button({
            icon_name: isLocked ? 'changes-prevent-symbolic' : 'changes-allow-symbolic',
            halign: Gtk.Align.END,
            valign: Gtk.Align.START,
            margin_top: 2,
            margin_end: 2,
            opacity: isLocked ? 1.0 : 0.0,
            css_classes: ['lock-button', 'flat'],
            tooltip_text: isLocked ? 'Click to unlock' : 'Click to lock',
        });

        const iconCss = `
            .lock-button {
                background-color: alpha(@window_bg_color, 0.9);
                border-radius: 0px;
                padding: 2px;
                min-width: 20px;
                min-height: 20px;
            }
            .lock-button:hover {
                background-color: alpha(@window_bg_color, 1.0);
            }
        `;
        applyCssToWidget(lockButton, iconCss);

        lockButton.connect('clicked', () => {
            this._toggleLock(index);
        });

        overlay.add_overlay(lockButton);

        // Click handler - edit color (only if unlocked)
        const clickGesture = new Gtk.GestureClick();
        clickGesture.connect('pressed', () => {
            if (this.onSwatchClick && !this._lockedColors[index]) {
                this.onSwatchClick(index, this._palette[index], colorBox);
            }
        });
        colorBox.add_controller(clickGesture);

        // Hover effect for lock button
        const hoverController = new Gtk.EventControllerMotion();
        hoverController.connect('enter', () => {
            lockButton.set_opacity(1.0);
        });
        hoverController.connect('leave', () => {
            lockButton.set_opacity(isLocked ? 1.0 : 0.0);
        });
        overlay.add_controller(hoverController);

        return overlay;
    }

    _toggleLock(index) {
        this._lockedColors[index] = !this._lockedColors[index];
        this._render();
    }

    isColorLocked(index) {
        return this._lockedColors[index];
    }

    getLockedColors() {
        return [...this._lockedColors];
    }

    setLockedColors(lockedStates) {
        this._lockedColors = [...lockedStates];
        this._render();
    }

    updateSwatchColor(index, hexColor) {
        this._palette[index] = hexColor;
        this._render();
    }
}
