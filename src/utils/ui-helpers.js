import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GObject from 'gi://GObject';

/**
 * UI helper functions for creating common GTK widgets,
 * managing icons, and building blueprint UI components.
 */

// ============================================================================
// Icon Utilities
// ============================================================================

let iconsRegistered = false;

/**
 * Get the absolute path to the icons directory
 * @returns {string} Absolute path to icons directory
 */
export function getIconsDir() {
    const scriptPath = import.meta.url.replace('file://', '');
    const scriptDir = GLib.path_get_dirname(scriptPath);
    const srcDir = GLib.path_get_dirname(scriptDir);
    return GLib.build_filenamev([srcDir, 'icons']);
}

/**
 * Register custom icons directory with GTK IconTheme
 * This allows custom icons to work like system icons with proper theming
 */
export function registerCustomIcons() {
    if (iconsRegistered) return;

    const display = Gdk.Display.get_default();
    const iconTheme = Gtk.IconTheme.get_for_display(display);
    const iconsDir = getIconsDir();

    iconTheme.add_search_path(iconsDir);
    console.log('Custom icons directory registered:', iconsDir);

    iconsRegistered = true;
}

/**
 * Get the absolute path to an icon file in src/icons/
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @returns {string} Absolute path to icon file
 */
export function getIconPath(iconName) {
    return GLib.build_filenamev([getIconsDir(), iconName]);
}

/**
 * Create a Gtk.Image from a custom SVG icon
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @param {number} size - Icon size in pixels (default: 16)
 * @returns {Gtk.Image} GTK Image widget with the custom icon
 */
export function createImageFromIcon(iconName, size = 16) {
    const iconPath = getIconPath(iconName);
    const file = Gio.File.new_for_path(iconPath);

    if (!file.query_exists(null)) {
        console.warn(`Icon file not found: ${iconPath}`);
        return new Gtk.Image({
            icon_name: 'image-missing',
            pixel_size: size,
        });
    }

    return new Gtk.Image({
        file: iconPath,
        pixel_size: size,
    });
}

/**
 * Set a custom icon on a button
 * @param {Gtk.Button} button - Button to set icon on
 * @param {string} iconName - Icon filename (e.g., 'image-edit.svg')
 * @param {number} size - Icon size in pixels (default: 16)
 */
export function setButtonIcon(button, iconName, size = 16) {
    const image = createImageFromIcon(iconName, size);
    button.set_child(image);
}

// ============================================================================
// Blueprint UI Helpers
// ============================================================================

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
 * Creates a horizontal color swatch row (for list views)
 * @param {Object} blueprint - Blueprint data
 * @param {number} swatchSize - Size of each swatch (default: 24)
 * @param {number} maxSwatches - Maximum number of swatches to show (default: 8)
 * @returns {Gtk.Box} Horizontal box with color swatches
 */
export function createColorSwatchRow(
    blueprint,
    swatchSize = 24,
    maxSwatches = 8
) {
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

// ============================================================================
// General UI Helpers
// ============================================================================

/**
 * Creates a CSS provider and applies styles to a widget
 * @param {Gtk.Widget} widget - Widget to style
 * @param {string} css - CSS string
 * @param {number} priority - Optional priority level (default: APPLICATION)
 */
export function applyCssToWidget(
    widget,
    css,
    priority = Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
) {
    const cssProvider = new Gtk.CssProvider();
    cssProvider.load_from_string(css);
    widget.get_style_context().add_provider(cssProvider, priority);
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
    const {label, min, max, defaultValue, step, onChange} = config;

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

    return {box, scale};
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

/**
 * Finds the first ancestor widget of a specific type
 * @param {Gtk.Widget} widget - Starting widget
 * @param {Function} type - Widget constructor/type to search for (e.g., Adw.ToastOverlay)
 * @returns {Gtk.Widget|null} Found ancestor or null
 */
export function findAncestor(widget, type) {
    let current = widget.get_parent();

    while (current) {
        if (current instanceof type) {
            return current;
        }
        current = current.get_parent();
    }

    return null;
}

/**
 * Shows a toast notification by finding the nearest ToastOverlay ancestor
 * @param {Gtk.Widget} widget - Widget to start searching from
 * @param {string} message - Toast message text
 * @param {number} [timeout=2] - Toast timeout in seconds
 * @returns {Adw.Toast|null} The toast object (for dismissing later) or null if failed
 */
export function showToast(widget, message, timeout = 2) {
    const toast = new Adw.Toast({
        title: message,
        timeout: timeout,
    });

    const toastOverlay = findAncestor(widget, Adw.ToastOverlay);

    if (!toastOverlay) {
        console.warn('No ToastOverlay found in widget hierarchy');
        return null;
    }

    toastOverlay.add_toast(toast);
    return toast;
}

/**
 * Temporarily blocks a signal handler, executes a function, then unblocks
 * @param {GObject.Object} object - GObject with signal
 * @param {number} signalId - Signal handler ID to block
 * @param {Function} fn - Function to execute while signal is blocked
 * @returns {*} Return value from fn
 */
export function withSignalBlocked(object, signalId, fn) {
    if (!signalId) {
        return fn();
    }

    GObject.signal_handler_block(object, signalId);
    try {
        return fn();
    } finally {
        GObject.signal_handler_unblock(object, signalId);
    }
}

/**
 * Updates a widget's value without triggering its signal
 * @param {GObject.Object} widget - Widget to update
 * @param {number} signalId - Signal handler ID to block
 * @param {*} value - Value to set
 * @param {string} [property='selected'] - Property name to set
 */
export function updateWithoutSignal(
    widget,
    signalId,
    value,
    property = 'selected'
) {
    withSignalBlocked(widget, signalId, () => {
        if (property === 'selected' && 'set_selected' in widget) {
            widget.set_selected(value);
        } else {
            widget[property] = value;
        }
    });
}
