import Gtk from 'gi://Gtk?version=4.0';

/**
 * Shared UI helpers for blueprint components
 * Used by both BlueprintManagerWindow and BlueprintWidget
 */

/**
 * Creates a color grid showing all 16 colors in 2 rows
 * @param {Object} blueprint - Blueprint data
 * @param {number} boxSize - Size of each color box (default: 20)
 * @returns {Gtk.Box} Color grid widget
 */
export function createColorGrid(blueprint, boxSize = 20) {
    const container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 1,
    });

    const colors = blueprint.palette?.colors || [];
    if (colors.length === 0) return container;

    // Row 1: colors 0-7
    const row1 = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 1,
    });
    for (let i = 0; i < 8 && i < colors.length; i++) {
        const box = new Gtk.Box({
            width_request: boxSize,
            height_request: boxSize,
        });
        setBoxColor(box, colors[i]);
        row1.append(box);
    }

    // Row 2: colors 8-15
    const row2 = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 1,
    });
    for (let i = 8; i < 16 && i < colors.length; i++) {
        const box = new Gtk.Box({
            width_request: boxSize,
            height_request: boxSize,
        });
        setBoxColor(box, colors[i]);
        row2.append(box);
    }

    container.append(row1);
    container.append(row2);
    return container;
}

/**
 * Sets background color of a Gtk.Box using CSS
 * @param {Gtk.Box} box - Box widget to style
 * @param {string} color - Hex color string
 */
export function setBoxColor(box, color) {
    const css = `* { background-color: ${color}; }`;
    const provider = new Gtk.CssProvider();
    provider.load_from_data(css, -1);
    box.get_style_context().add_provider(
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );
}

/**
 * Creates a horizontal color swatch row (for list views)
 * @param {Object} blueprint - Blueprint data
 * @param {number} swatchSize - Size of each swatch (default: 24)
 * @param {number} maxSwatches - Maximum number of swatches to show (default: 8)
 * @returns {Gtk.Box} Horizontal box with color swatches
 */
export function createColorSwatchRow(blueprint, swatchSize = 24, maxSwatches = 8) {
    const colorBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
    });

    const colors = blueprint.palette?.colors || [];
    const displayColors = colors.slice(0, maxSwatches);

    displayColors.forEach(color => {
        const box = new Gtk.Box({
            width_request: swatchSize,
            height_request: swatchSize,
        });
        setBoxColor(box, color);
        colorBox.append(box);
    });

    return colorBox;
}
