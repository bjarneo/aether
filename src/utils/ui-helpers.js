import Gtk from 'gi://Gtk?version=4.0';

/**
 * UI helper functions for creating common GTK widgets
 */

/**
 * Creates a CSS provider and applies styles to a widget
 * @param {Gtk.Widget} widget - Widget to style
 * @param {string} css - CSS string
 */
export function applyCssToWidget(widget, css) {
    const cssProvider = new Gtk.CssProvider();
    cssProvider.load_from_string(css);
    widget.get_style_context().add_provider(
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );
}

/**
 * Creates a labeled slider with a box container
 * @param {Object} config - Slider configuration
 * @param {string} config.label - Label text
 * @param {number} config.min - Minimum value
 * @param {number} config.max - Maximum value
 * @param {number} config.defaultValue - Default value
 * @param {number} config.step - Step increment
 * @param {Function} config.onChange - Change callback
 * @returns {Object} Object with box (Gtk.Box) and scale (Gtk.Scale)
 */
export function createLabeledSlider(config) {
    const {
        label,
        min,
        max,
        defaultValue,
        step,
        onChange
    } = config;

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        margin_start: 6,
        margin_end: 6,
        margin_top: 2,
        margin_bottom: 2,
    });

    const labelWidget = new Gtk.Label({
        label,
        width_chars: 12,
        xalign: 0,
    });

    const scale = new Gtk.Scale({
        orientation: Gtk.Orientation.HORIZONTAL,
        adjustment: new Gtk.Adjustment({
            lower: min,
            upper: max,
            value: defaultValue,
            step_increment: step,
        }),
        draw_value: true,
        value_pos: Gtk.PositionType.RIGHT,
        hexpand: true,
    });

    if (onChange) {
        scale.connect('value-changed', onChange);
    }

    box.append(labelWidget);
    box.append(scale);

    return { box, scale };
}

/**
 * Creates a margin configuration object
 * @param {number} value - Margin value for all sides (or top/bottom if horizontal specified)
 * @param {number} horizontal - Optional horizontal margin
 * @returns {Object} Margin configuration object
 */
export function createMargins(value, horizontal = null) {
    if (horizontal !== null) {
        return {
            margin_top: value,
            margin_bottom: value,
            margin_start: horizontal,
            margin_end: horizontal,
        };
    }
    return {
        margin_top: value,
        margin_bottom: value,
        margin_start: value,
        margin_end: value,
    };
}

/**
 * Removes all children from a widget
 * @param {Gtk.Widget} widget - Parent widget
 */
export function removeAllChildren(widget) {
    let child = widget.get_first_child();
    while (child) {
        const next = child.get_next_sibling();
        widget.remove(child);
        child = next;
    }
}

/**
 * Iterates through all children of a widget
 * @param {Gtk.Widget} widget - Parent widget
 * @param {Function} callback - Callback function (child, index)
 */
export function forEachChild(widget, callback) {
    let child = widget.get_first_child();
    let index = 0;
    while (child) {
        const next = child.get_next_sibling();
        callback(child, index);
        child = next;
        index++;
    }
}
