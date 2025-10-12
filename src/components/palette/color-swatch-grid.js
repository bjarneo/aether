import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget, removeAllChildren} from '../../utils/ui-helpers.js';
import {
    ANSI_COLOR_NAMES,
    PALETTE_CONFIG,
    SWATCH_DIMENSIONS,
} from '../../constants/colors.js';

/**
 * Creates and manages a grid of color swatches
 * @param {Function} onSwatchClick - Callback when a swatch is clicked (index, color, element)
 * @param {Object} options - Configuration options
 * @param {boolean} options.showLockButtons - Show lock buttons (default: true)
 * @param {boolean} options.miniMode - Use mini size for swatches (default: false)
 * @param {number} options.selectedIndex - Initially selected index for mini mode (default: 0)
 */
export class ColorSwatchGrid {
    constructor(onSwatchClick, options = {}) {
        this.onSwatchClick = onSwatchClick;
        this._palette = [];
        this._lockedColors = new Array(16).fill(false); // Track lock state for each color
        this._showLockButtons = options.showLockButtons !== false;
        this._miniMode = options.miniMode || false;
        this._selectedIndex = options.selectedIndex ?? 0;

        const dimensions = this._miniMode
            ? {width: 32, height: 32}
            : SWATCH_DIMENSIONS.default;

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
        const dimensions = this._miniMode
            ? {width: 32, height: 32}
            : SWATCH_DIMENSIONS.default;

        // Container overlay for color + lock icon
        const overlay = new Gtk.Overlay({
            width_request: dimensions.width,
            height_request: dimensions.height,
        });

        const colorBox = new Gtk.Box({
            width_request: dimensions.width,
            height_request: dimensions.height,
            css_classes: ['color-swatch'],
            tooltip_text: ANSI_COLOR_NAMES[index] || `Color ${index}`,
        });

        const isLocked = this._lockedColors[index];
        const isSelected = this._miniMode && index === this._selectedIndex;

        // In mini mode, show selection border; in normal mode, show lock border
        let borderStyle;
        if (this._miniMode) {
            borderStyle = isSelected
                ? '2px solid alpha(@accent_bg_color, 0.8)'
                : '2px solid alpha(@borders, 0.3)';
        } else {
            borderStyle = isLocked
                ? '2px solid alpha(@accent_bg_color, 0.8)'
                : '2px solid alpha(@borders, 0.3)';
        }

        const css = `
            .color-swatch {
                background-color: ${color};
                border-radius: 0px;
                border: ${borderStyle};
                min-width: ${dimensions.width}px;
                min-height: ${dimensions.height}px;
            }
            .color-swatch:hover {
                border: 2px solid alpha(@accent_bg_color, 0.6);
            }
        `;

        applyCssToWidget(colorBox, css);
        colorBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

        overlay.set_child(colorBox);

        // Lock icon button overlay (only in normal mode)
        if (this._showLockButtons && !this._miniMode) {
            const lockButton = new Gtk.Button({
                icon_name: isLocked
                    ? 'changes-prevent-symbolic'
                    : 'changes-allow-symbolic',
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

            // Hover effect for lock button
            const hoverController = new Gtk.EventControllerMotion();
            hoverController.connect('enter', () => {
                lockButton.set_opacity(1.0);
            });
            hoverController.connect('leave', () => {
                lockButton.set_opacity(isLocked ? 1.0 : 0.0);
            });
            overlay.add_controller(hoverController);
        }

        // Click handler
        const clickGesture = new Gtk.GestureClick();
        clickGesture.connect('pressed', () => {
            if (this._miniMode) {
                // In mini mode, clicking selects the swatch
                this._selectedIndex = index;
                this._render();
                if (this.onSwatchClick) {
                    this.onSwatchClick(index, this._palette[index], colorBox);
                }
            } else {
                // In normal mode, only click if unlocked
                if (this.onSwatchClick && !this._lockedColors[index]) {
                    this.onSwatchClick(index, this._palette[index], colorBox);
                }
            }
        });
        colorBox.add_controller(clickGesture);

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

    getSelectedIndex() {
        return this._selectedIndex;
    }
}
