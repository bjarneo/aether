import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {generateShades} from '../../services/color-harmony.js';
import {
    findClosestShade,
    rgbaToHex,
    ensureHashPrefix,
} from '../../utils/color-utils.js';
import {
    ANSI_COLOR_NAMES,
    PALETTE_CONFIG,
    SWATCH_DIMENSIONS,
} from '../../constants/colors.js';

/**
 * Handles color picker dialogs for palette swatches
 */
export class ColorPickerDialog {
    constructor(parentWindow, palette) {
        this.parentWindow = parentWindow;
        this.palette = palette;
    }

    openShadePicker(index, currentColor, onColorSelected) {
        const hexColor = ensureHashPrefix(currentColor);
        const shades = generateShades(hexColor, PALETTE_CONFIG.shadeCount);
        const closestShadeIndex = findClosestShade(hexColor, shades);

        const dialog = new Gtk.Dialog({
            title: `Select Shade - ${ANSI_COLOR_NAMES[index]}`,
            modal: true,
            transient_for: this.parentWindow,
            use_header_bar: true,
        });

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
        });

        const shadesFlow = this._createShadesFlow(
            shades,
            closestShadeIndex,
            shade => {
                onColorSelected(shade);
                dialog.close();
            }
        );

        contentBox.append(shadesFlow);

        const pickerButton = new Gtk.Button({
            label: '+ Custom Color',
            css_classes: ['suggested-action'],
            margin_top: 4,
        });

        pickerButton.connect('clicked', () => {
            dialog.close();
            this.openFullColorPicker(index, hexColor, onColorSelected);
        });

        contentBox.append(pickerButton);

        const contentArea = dialog.get_content_area();
        contentArea.append(contentBox);

        dialog.connect('response', () => dialog.close());
        dialog.present();
    }

    _createShadesFlow(shades, activeIndex, onShadeClick) {
        const shadesFlow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 4,
            row_spacing: 4,
            homogeneous: true,
            max_children_per_line: 5,
            min_children_per_line: 5,
        });

        shades.forEach((shade, index) => {
            const shadeBox = this._createShadeBox(
                shade,
                index === activeIndex,
                onShadeClick
            );
            shadesFlow.append(shadeBox);
        });

        return shadesFlow;
    }

    _createShadeBox(shade, isActive, onClick) {
        const overlay = new Gtk.Overlay({
            width_request: SWATCH_DIMENSIONS.large.width,
            height_request: SWATCH_DIMENSIONS.large.height,
        });

        const shadeBox = new Gtk.Box({
            width_request: SWATCH_DIMENSIONS.large.width,
            height_request: SWATCH_DIMENSIONS.large.height,
            css_classes: ['color-swatch'],
            tooltip_text: shade + (isActive ? ' (current)' : ''),
        });

        const borderStyle = isActive
            ? 'border: 2px solid rgba(255, 255, 255, 0.9);'
            : 'border: 2px solid alpha(@borders, 0.3);';

        const css = `
            .color-swatch {
                background-color: ${shade};
                border-radius: 0px;
                ${borderStyle}
            }
            .color-swatch:hover {
                border: 2px solid rgba(255, 255, 255, 0.9);
            }
        `;

        applyCssToWidget(shadeBox, css);
        shadeBox.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

        overlay.set_child(shadeBox);

        // Add checkmark for selected shade
        if (isActive) {
            const checkmark = new Gtk.Image({
                icon_name: 'object-select-symbolic',
                pixel_size: 24,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
            });

            const checkCss = `
                image {
                    color: rgba(255, 255, 255, 0.9);
                    -gtk-icon-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
                }
            `;
            applyCssToWidget(checkmark, checkCss);
            overlay.add_overlay(checkmark);
        }

        const gesture = new Gtk.GestureClick();
        gesture.connect('pressed', () => onClick(shade));
        shadeBox.add_controller(gesture);

        return overlay;
    }

    openFullColorPicker(index, currentColor, onColorSelected) {
        const rgba = new Gdk.RGBA();
        const parsed = rgba.parse(currentColor);

        if (!parsed) {
            console.error(`Failed to parse color: ${currentColor}`);
            return;
        }

        const dialog = new Gtk.Dialog({
            title: `Custom Color - ${ANSI_COLOR_NAMES[index]}`,
            modal: true,
            transient_for: this.parentWindow,
            use_header_bar: true,
        });

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button('Select', Gtk.ResponseType.OK);

        const colorChooser = new Gtk.ColorChooserWidget({
            show_editor: true,
            use_alpha: false,
        });

        colorChooser.set_rgba(rgba);

        // Add palette colors
        const paletteColors = this.palette.map(color => {
            const c = new Gdk.RGBA();
            c.parse(ensureHashPrefix(color));
            return c;
        });

        colorChooser.add_palette(Gtk.Orientation.HORIZONTAL, 8, paletteColors);

        const contentArea = dialog.get_content_area();
        contentArea.append(colorChooser);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
                const newRgba = colorChooser.get_rgba();
                const newHex = rgbaToHex(newRgba);
                onColorSelected(newHex);
            }
            dialog.close();
        });

        dialog.present();
    }
}
