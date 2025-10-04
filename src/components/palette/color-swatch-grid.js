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
        const colorBox = new Gtk.Box({
            width_request: SWATCH_DIMENSIONS.default.width,
            height_request: SWATCH_DIMENSIONS.default.height,
            css_classes: ['color-swatch'],
            tooltip_text: ANSI_COLOR_NAMES[index] || `Color ${index}`,
        });

        const css = `
            .color-swatch {
                background-color: ${color};
                border-radius: 6px;
                border: 1px solid alpha(@borders, 0.5);
                min-width: ${SWATCH_DIMENSIONS.default.width}px;
                min-height: ${SWATCH_DIMENSIONS.default.height}px;
            }
            .color-swatch:hover {
                border: 2px solid alpha(@borders, 1.0);
            }
        `;

        applyCssToWidget(colorBox, css);
        colorBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

        const gesture = new Gtk.GestureClick();
        gesture.connect('pressed', () => {
            if (this.onSwatchClick) {
                this.onSwatchClick(index, this._palette[index], colorBox);
            }
        });
        colorBox.add_controller(gesture);

        return colorBox;
    }

    updateSwatchColor(index, hexColor) {
        this._palette[index] = hexColor;
        this._render();
    }
}
