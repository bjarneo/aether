import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {SPACING} from '../../constants/ui-constants.js';

/**
 * Creates a styled section header with uppercase text and letter-spacing
 * @param {string} title - Header text (will be uppercased)
 * @param {string} [subtitle] - Optional subtitle text
 * @returns {Gtk.Box} Header widget
 */
export function createSectionHeader(title, subtitle = null) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
        margin_top: SPACING.MD,
        margin_bottom: SPACING.SM,
        margin_start: SPACING.MD,
        margin_end: SPACING.MD,
    });

    const header = new Gtk.Label({
        label: title.toUpperCase(),
        xalign: 0,
        hexpand: true,
    });
    applyCssToWidget(
        header,
        `
        label {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            opacity: 0.7;
        }
    `
    );
    box.append(header);

    if (subtitle) {
        const sub = new Gtk.Label({
            label: subtitle,
            xalign: 0,
            hexpand: true,
        });
        applyCssToWidget(
            sub,
            `
            label {
                font-size: 11px;
                opacity: 0.5;
            }
        `
        );
        box.append(sub);
    }

    return box;
}

/**
 * Creates a toolbar row with left/right sections
 * @param {Object} options
 * @param {Gtk.Widget[]} [options.start] - Widgets for start (left) side
 * @param {Gtk.Widget[]} [options.end] - Widgets for end (right) side
 * @returns {Gtk.Box} Toolbar widget
 */
export function createToolbar(options = {}) {
    const toolbar = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: SPACING.SM,
        margin_bottom: SPACING.MD,
    });

    // Start section
    const startBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: SPACING.SM,
        hexpand: true,
    });

    if (options.start) {
        options.start.forEach(widget => startBox.append(widget));
    }

    toolbar.append(startBox);

    // End section
    if (options.end) {
        const endBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: SPACING.SM,
        });
        options.end.forEach(widget => endBox.append(widget));
        toolbar.append(endBox);
    }

    return toolbar;
}

/**
 * Creates an empty state display
 * @param {Object} options
 * @param {string} options.icon - Icon name
 * @param {string} options.title - Title text
 * @param {string} [options.description] - Description text
 * @returns {Gtk.Box} Empty state widget
 */
export function createEmptyState(options) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: SPACING.MD,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        vexpand: true,
        margin_top: 48,
        margin_bottom: 48,
    });

    const icon = new Gtk.Image({
        icon_name: options.icon,
        pixel_size: 64,
    });
    applyCssToWidget(
        icon,
        `
        image {
            opacity: 0.3;
        }
    `
    );
    box.append(icon);

    const title = new Gtk.Label({
        label: options.title,
        halign: Gtk.Align.CENTER,
    });
    applyCssToWidget(
        title,
        `
        label {
            font-size: 16px;
            font-weight: 600;
            opacity: 0.7;
        }
    `
    );
    box.append(title);

    if (options.description) {
        const desc = new Gtk.Label({
            label: options.description,
            halign: Gtk.Align.CENTER,
            wrap: true,
            max_width_chars: 40,
        });
        applyCssToWidget(
            desc,
            `
            label {
                font-size: 13px;
                opacity: 0.5;
            }
        `
        );
        box.append(desc);
    }

    return box;
}

/**
 * Applies sharp button styling
 * @param {Gtk.Button} button - Button to style
 * @param {Object} [options]
 * @param {boolean} [options.flat] - Use flat styling
 */
export function styleButton(button, options = {}) {
    const bg = options.flat
        ? 'background: none;'
        : 'background-color: alpha(@view_bg_color, 0.5);';

    applyCssToWidget(
        button,
        `
        button {
            border-radius: 0;
            padding: 6px 12px;
            ${bg}
        }
        button:hover {
            background-color: alpha(@accent_bg_color, 0.1);
        }
    `
    );
}
