/**
 * ui-builders.js - Reusable UI component builders for Aether
 *
 * Provides factory functions for common GTK/Libadwaita UI patterns:
 * - Switch rows (toggle settings)
 * - Color picker rows
 * - Dropdown rows
 * - Slider rows
 * - Action rows with buttons
 * - Preference groups
 *
 * These builders reduce boilerplate and ensure consistent styling
 * across the application.
 *
 * @module ui-builders
 */

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {SPACING, MARGINS, SLIDER, TIMING} from '../constants/ui-constants.js';
import {applyCssToWidget} from './ui-helpers.js';

// ============================================================================
// SWITCH ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a switch control
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {boolean} [config.active=false] - Initial switch state
 * @param {function(boolean): void} [config.onChanged] - Callback when switch toggled
 * @param {string} [config.tooltip] - Tooltip text
 * @returns {{row: Adw.ActionRow, switch: Gtk.Switch}} Row and switch widgets
 *
 * @example
 * const {row, switch: sw} = createSwitchRow({
 *     title: 'Enable Feature',
 *     subtitle: 'Turn this feature on or off',
 *     active: true,
 *     onChanged: (active) => console.log('Switch:', active),
 * });
 * group.add(row);
 */
export function createSwitchRow(config) {
    const {
        title,
        subtitle = '',
        active = false,
        onChanged,
        tooltip,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const switchWidget = new Gtk.Switch({
        active,
        valign: Gtk.Align.CENTER,
    });

    if (tooltip) {
        switchWidget.set_tooltip_text(tooltip);
    }

    if (onChanged) {
        switchWidget.connect('notify::active', (sw) => {
            onChanged(sw.get_active());
        });
    }

    row.add_suffix(switchWidget);
    row.set_activatable_widget(switchWidget);

    return {row, switch: switchWidget};
}

// ============================================================================
// COLOR PICKER ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a color picker button
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {string} [config.initialColor='#ffffff'] - Initial color (hex)
 * @param {boolean} [config.withAlpha=false] - Allow alpha channel selection
 * @param {function(string): void} [config.onChanged] - Callback with hex color
 * @param {string} [config.tooltip] - Tooltip text
 * @returns {{row: Adw.ActionRow, button: Gtk.ColorDialogButton}} Row and button widgets
 *
 * @example
 * const {row, button} = createColorPickerRow({
 *     title: 'Background Color',
 *     initialColor: '#1e1e2e',
 *     onChanged: (hex) => console.log('Color:', hex),
 * });
 */
export function createColorPickerRow(config) {
    const {
        title,
        subtitle = '',
        initialColor = '#ffffff',
        withAlpha = false,
        onChanged,
        tooltip,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const rgba = new Gdk.RGBA();
    rgba.parse(initialColor);

    const button = new Gtk.ColorDialogButton({
        valign: Gtk.Align.CENTER,
        rgba,
    });

    if (tooltip) {
        button.set_tooltip_text(tooltip);
    }

    // Defer dialog creation until widget is realized
    button.connect('realize', (btn) => {
        if (!btn.dialog) {
            btn.dialog = new Gtk.ColorDialog({with_alpha: withAlpha});
        }
    });

    if (onChanged) {
        button.connect('notify::rgba', (btn) => {
            const color = btn.get_rgba();
            const hex = rgbaToHex(color);
            onChanged(hex);
        });
    }

    row.add_suffix(button);

    return {row, button};
}

/**
 * Converts Gdk.RGBA to hex string
 * @param {Gdk.RGBA} rgba - RGBA color
 * @returns {string} Hex color string
 * @private
 */
function rgbaToHex(rgba) {
    const r = Math.round(rgba.red * 255);
    const g = Math.round(rgba.green * 255);
    const b = Math.round(rgba.blue * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// DROPDOWN ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a dropdown selector
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {string[]} config.options - Array of option labels
 * @param {number} [config.selected=0] - Initially selected index
 * @param {function(number, string): void} [config.onChanged] - Callback with index and label
 * @returns {{row: Adw.ActionRow, dropdown: Gtk.DropDown}} Row and dropdown widgets
 *
 * @example
 * const {row, dropdown} = createDropdownRow({
 *     title: 'Sort By',
 *     options: ['Name', 'Date', 'Size'],
 *     selected: 0,
 *     onChanged: (index, label) => console.log('Selected:', label),
 * });
 */
export function createDropdownRow(config) {
    const {
        title,
        subtitle = '',
        options,
        selected = 0,
        onChanged,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const dropdown = new Gtk.DropDown({
        model: new Gtk.StringList(),
        valign: Gtk.Align.CENTER,
    });

    const model = dropdown.get_model();
    options.forEach(option => model.append(option));

    dropdown.set_selected(selected);

    if (onChanged) {
        dropdown.connect('notify::selected', (dd) => {
            const index = dd.get_selected();
            const label = options[index];
            onChanged(index, label);
        });
    }

    row.add_suffix(dropdown);

    return {row, dropdown};
}

// ============================================================================
// SLIDER ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a slider control
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {number} config.min - Minimum value
 * @param {number} config.max - Maximum value
 * @param {number} [config.step=1] - Step increment
 * @param {number} [config.value] - Initial value (defaults to min)
 * @param {string} [config.unit=''] - Unit suffix for display (%, px, etc.)
 * @param {number} [config.width] - Slider width (default from UI constants)
 * @param {boolean} [config.showValue=true] - Show value label
 * @param {boolean} [config.doubleClickReset=true] - Reset on double-click
 * @param {function(number): void} [config.onChanged] - Callback with value
 * @returns {{row: Adw.ActionRow, scale: Gtk.Scale, setValue: function, getValue: function, reset: function}} Row and control functions
 *
 * @example
 * const {row, setValue, getValue} = createSliderRow({
 *     title: 'Volume',
 *     min: 0,
 *     max: 100,
 *     value: 50,
 *     unit: '%',
 *     onChanged: (val) => setVolume(val),
 * });
 */
export function createSliderRow(config) {
    const {
        title,
        subtitle = '',
        min,
        max,
        step = 1,
        value = min,
        unit = '',
        width = SLIDER.WIDTH,
        showValue = true,
        doubleClickReset = true,
        onChanged,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: SPACING.LG,
        margin_top: 14,
        margin_bottom: 14,
        margin_start: 8,
        margin_end: 8,
    });

    const scale = new Gtk.Scale({
        orientation: Gtk.Orientation.HORIZONTAL,
        draw_value: false,
        hexpand: false,
        width_request: width,
    });
    scale.set_range(min, max);
    scale.set_increments(step, step * 5);
    scale.set_value(value);

    let valueLabel = null;
    const defaultValue = value;

    const formatValue = (val) => `${Math.round(val)}${unit}`;

    if (showValue) {
        valueLabel = new Gtk.Label({
            label: formatValue(value),
            width_chars: SLIDER.VALUE_LABEL_CHARS,
            xalign: 1,
            css_classes: ['monospace', 'dim-label'],
        });
    }

    scale.connect('value-changed', () => {
        const val = scale.get_value();
        if (valueLabel) {
            valueLabel.set_label(formatValue(val));
        }
        if (onChanged) {
            onChanged(val);
        }
    });

    // Double-click to reset
    if (doubleClickReset) {
        let clickCount = 0;
        let clickTimeout = null;

        const gesture = new Gtk.GestureClick();
        gesture.connect('pressed', () => {
            clickCount++;

            if (clickTimeout) {
                GLib.source_remove(clickTimeout);
            }

            clickTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                TIMING.DOUBLE_CLICK,
                () => {
                    if (clickCount === 2) {
                        scale.set_value(defaultValue);
                    }
                    clickCount = 0;
                    clickTimeout = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
        scale.add_controller(gesture);
    }

    box.append(scale);
    if (valueLabel) {
        box.append(valueLabel);
    }
    row.add_suffix(box);

    // Helper functions
    const setValue = (val, emit = true) => {
        scale.set_value(val);
        if (valueLabel) {
            valueLabel.set_label(formatValue(val));
        }
    };

    const getValue = () => scale.get_value();

    const reset = () => setValue(defaultValue);

    return {row, scale, setValue, getValue, reset};
}

// ============================================================================
// BUTTON ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with an action button
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {string} config.buttonLabel - Button text
 * @param {string} [config.buttonIcon] - Button icon name (optional)
 * @param {string[]} [config.buttonClasses=[]] - CSS classes for button
 * @param {function(): void} config.onClicked - Button click callback
 * @returns {{row: Adw.ActionRow, button: Gtk.Button}} Row and button widgets
 *
 * @example
 * const {row, button} = createButtonRow({
 *     title: 'Clear Cache',
 *     subtitle: 'Remove all cached files',
 *     buttonLabel: 'Clear',
 *     buttonClasses: ['destructive-action'],
 *     onClicked: () => clearCache(),
 * });
 */
export function createButtonRow(config) {
    const {
        title,
        subtitle = '',
        buttonLabel,
        buttonIcon,
        buttonClasses = [],
        onClicked,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const button = new Gtk.Button({
        label: buttonLabel,
        valign: Gtk.Align.CENTER,
        css_classes: buttonClasses,
    });

    if (buttonIcon) {
        button.set_icon_name(buttonIcon);
    }

    button.connect('clicked', onClicked);

    row.add_suffix(button);

    return {row, button};
}

/**
 * Creates an Adw.ActionRow with an icon button
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle/description
 * @param {string} config.iconName - Icon name
 * @param {string} [config.tooltip] - Button tooltip
 * @param {string[]} [config.buttonClasses=['flat']] - CSS classes for button
 * @param {function(): void} config.onClicked - Button click callback
 * @returns {{row: Adw.ActionRow, button: Gtk.Button}} Row and button widgets
 */
export function createIconButtonRow(config) {
    const {
        title,
        subtitle = '',
        iconName,
        tooltip,
        buttonClasses = ['flat'],
        onClicked,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const button = new Gtk.Button({
        icon_name: iconName,
        valign: Gtk.Align.CENTER,
        css_classes: buttonClasses,
    });

    if (tooltip) {
        button.set_tooltip_text(tooltip);
    }

    button.connect('clicked', onClicked);

    row.add_suffix(button);

    return {row, button};
}

// ============================================================================
// PREFERENCE GROUPS
// ============================================================================

/**
 * Creates an Adw.PreferencesGroup with optional header widgets
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Group title
 * @param {string} [config.description] - Group description
 * @param {Gtk.Widget} [config.headerSuffix] - Widget to add to header
 * @returns {Adw.PreferencesGroup} The preferences group
 *
 * @example
 * const group = createPreferencesGroup({
 *     title: 'Appearance',
 *     description: 'Customize the look and feel',
 * });
 */
export function createPreferencesGroup(config) {
    const {title, description = '', headerSuffix} = config;

    const group = new Adw.PreferencesGroup({
        title,
        description,
    });

    if (headerSuffix) {
        group.set_header_suffix(headerSuffix);
    }

    return group;
}

/**
 * Creates an Adw.ExpanderRow for collapsible sections
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle
 * @param {boolean} [config.expanded=false] - Initially expanded
 * @param {string} [config.iconName] - Optional prefix icon
 * @returns {Adw.ExpanderRow} The expander row
 *
 * @example
 * const expander = createExpanderRow({
 *     title: 'Advanced Settings',
 *     subtitle: 'Additional configuration options',
 *     expanded: false,
 * });
 * expander.add_row(someRow);
 */
export function createExpanderRow(config) {
    const {
        title,
        subtitle = '',
        expanded = false,
        iconName,
    } = config;

    const row = new Adw.ExpanderRow({
        title,
        subtitle,
        expanded,
    });

    if (iconName) {
        row.set_icon_name(iconName);
    }

    return row;
}

// ============================================================================
// CHECKBOX ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a checkbox
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle
 * @param {boolean} [config.active=false] - Initial checked state
 * @param {function(boolean): void} [config.onChanged] - Callback when toggled
 * @returns {{row: Adw.ActionRow, checkbox: Gtk.CheckButton}} Row and checkbox widgets
 */
export function createCheckboxRow(config) {
    const {
        title,
        subtitle = '',
        active = false,
        onChanged,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const checkbox = new Gtk.CheckButton({
        active,
        valign: Gtk.Align.CENTER,
    });

    if (onChanged) {
        checkbox.connect('toggled', (cb) => {
            onChanged(cb.get_active());
        });
    }

    row.add_suffix(checkbox);
    row.set_activatable_widget(checkbox);

    return {row, checkbox};
}

// ============================================================================
// COLOR SWATCH GRID
// ============================================================================

/**
 * Creates a grid of color swatches
 *
 * @param {Object} config - Configuration options
 * @param {string[]} config.colors - Array of hex colors
 * @param {number} [config.swatchSize=32] - Size of each swatch
 * @param {number} [config.columns=8] - Number of columns
 * @param {number} [config.spacing=4] - Spacing between swatches
 * @param {function(string, number): void} [config.onColorClicked] - Callback with color and index
 * @returns {Gtk.FlowBox} The color grid widget
 *
 * @example
 * const grid = createColorSwatchGrid({
 *     colors: ['#ff0000', '#00ff00', '#0000ff'],
 *     swatchSize: 24,
 *     onColorClicked: (color, index) => selectColor(color),
 * });
 */
export function createColorSwatchGrid(config) {
    const {
        colors,
        swatchSize = 32,
        columns = 8,
        spacing = 4,
        onColorClicked,
    } = config;

    const grid = new Gtk.FlowBox({
        max_children_per_line: columns,
        min_children_per_line: Math.min(columns, colors.length),
        selection_mode: Gtk.SelectionMode.NONE,
        column_spacing: spacing,
        row_spacing: spacing,
        homogeneous: true,
    });

    colors.forEach((color, index) => {
        const swatch = new Gtk.Button({
            width_request: swatchSize,
            height_request: swatchSize,
        });

        const css = `* {
            background-color: ${color};
            min-width: ${swatchSize}px;
            min-height: ${swatchSize}px;
            border: 1px solid alpha(currentColor, 0.2);
        }
        *:hover {
            border: 2px solid white;
        }`;
        applyCssToWidget(swatch, css);

        if (onColorClicked) {
            swatch.connect('clicked', () => {
                onColorClicked(color, index);
            });
        }

        grid.append(swatch);
    });

    return grid;
}

// ============================================================================
// SCROLLED CONTAINERS
// ============================================================================

/**
 * Creates a scrolled window with standard configuration
 *
 * @param {Object} config - Configuration options
 * @param {Gtk.Widget} [config.child] - Child widget
 * @param {number} [config.minHeight] - Minimum height
 * @param {number} [config.maxHeight] - Maximum height (sets height_request)
 * @param {boolean} [config.hscroll=false] - Enable horizontal scrolling
 * @param {boolean} [config.vscroll=true] - Enable vertical scrolling
 * @returns {Gtk.ScrolledWindow} The scrolled window
 */
export function createScrolledWindow(config) {
    const {
        child,
        minHeight,
        maxHeight,
        hscroll = false,
        vscroll = true,
    } = config;

    const scrolled = new Gtk.ScrolledWindow({
        hscrollbar_policy: hscroll ? Gtk.PolicyType.AUTOMATIC : Gtk.PolicyType.NEVER,
        vscrollbar_policy: vscroll ? Gtk.PolicyType.AUTOMATIC : Gtk.PolicyType.NEVER,
    });

    if (minHeight) {
        scrolled.set_min_content_height(minHeight);
    }

    if (maxHeight) {
        scrolled.set_size_request(-1, maxHeight);
    }

    if (child) {
        scrolled.set_child(child);
    }

    return scrolled;
}

// ============================================================================
// LABELED BOX
// ============================================================================

/**
 * Creates a horizontal box with a label and widget
 *
 * @param {Object} config - Configuration options
 * @param {string} config.label - Label text
 * @param {Gtk.Widget} config.widget - Widget to display
 * @param {number} [config.spacing=8] - Spacing between label and widget
 * @returns {Gtk.Box} The labeled box
 */
export function createLabeledBox(config) {
    const {label, widget, spacing = 8} = config;

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing,
        halign: Gtk.Align.FILL,
    });

    const labelWidget = new Gtk.Label({
        label,
        xalign: 0,
        hexpand: true,
    });

    box.append(labelWidget);
    box.append(widget);

    return box;
}

// ============================================================================
// INFO/STATUS ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow with a status prefix icon and optional action button
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle
 * @param {string} [config.prefixIcon] - Icon name for prefix
 * @param {string[]} [config.prefixClasses=[]] - CSS classes for prefix icon
 * @param {string} [config.buttonLabel] - Optional action button label
 * @param {string} [config.buttonIcon] - Optional action button icon
 * @param {string[]} [config.buttonClasses=[]] - CSS classes for button
 * @param {function(): void} [config.onClicked] - Button click callback
 * @param {boolean} [config.activatable=false] - Whether row is activatable
 * @returns {{row: Adw.ActionRow, prefixIcon?: Gtk.Image, button?: Gtk.Button}} Row and widgets
 *
 * @example
 * const {row, prefixIcon} = createInfoRow({
 *     title: 'API Key',
 *     subtitle: 'Connected to server',
 *     prefixIcon: 'emblem-ok-symbolic',
 *     prefixClasses: ['success'],
 *     buttonLabel: 'Configure',
 *     onClicked: () => showConfigDialog(),
 * });
 */
export function createInfoRow(config) {
    const {
        title,
        subtitle = '',
        prefixIcon,
        prefixClasses = [],
        buttonLabel,
        buttonIcon,
        buttonClasses = [],
        onClicked,
        activatable = false,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
        activatable,
    });

    let iconWidget = null;
    if (prefixIcon) {
        iconWidget = new Gtk.Image({
            icon_name: prefixIcon,
            valign: Gtk.Align.CENTER,
        });
        prefixClasses.forEach(cls => iconWidget.add_css_class(cls));
        row.add_prefix(iconWidget);
    }

    let button = null;
    if (buttonLabel || buttonIcon) {
        button = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            css_classes: buttonClasses,
        });

        if (buttonLabel) {
            button.set_label(buttonLabel);
        }
        if (buttonIcon) {
            button.set_icon_name(buttonIcon);
        }

        if (onClicked) {
            button.connect('clicked', onClicked);
        }

        row.add_suffix(button);

        if (activatable) {
            row.set_activatable_widget(button);
        }
    }

    return {row, prefixIcon: iconWidget, button};
}

/**
 * Creates an Adw.ActionRow styled as a clickable link row
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle
 * @param {string} [config.prefixIcon='web-browser-symbolic'] - Prefix icon
 * @param {string} config.url - URL to open
 * @returns {{row: Adw.ActionRow, button: Gtk.Button}} Row and button widgets
 *
 * @example
 * const {row} = createLinkRow({
 *     title: 'Browse Community',
 *     subtitle: 'Discover themes shared by others',
 *     url: 'https://example.com',
 * });
 */
export function createLinkRow(config) {
    const {
        title,
        subtitle = '',
        prefixIcon = 'web-browser-symbolic',
        url,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
        activatable: true,
    });

    const linkIcon = new Gtk.Image({
        icon_name: prefixIcon,
        valign: Gtk.Align.CENTER,
    });
    row.add_prefix(linkIcon);

    const openButton = new Gtk.Button({
        icon_name: 'external-link-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });

    openButton.connect('clicked', () => {
        Gio.AppInfo.launch_default_for_uri(url, null);
    });

    row.add_suffix(openButton);
    row.set_activatable_widget(openButton);

    return {row, button: openButton};
}

// ============================================================================
// PRESET/CLICKABLE ROWS
// ============================================================================

/**
 * Creates an Adw.ActionRow for a preset item with optional preview
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Preset name
 * @param {string} [config.subtitle] - Preset description
 * @param {Gtk.Widget} [config.preview] - Preview widget (e.g., color swatches)
 * @param {function(): void} config.onActivated - Callback when row is activated
 * @returns {{row: Adw.ActionRow}} The row widget
 *
 * @example
 * const {row} = createPresetRow({
 *     title: 'Dracula',
 *     subtitle: 'Dark purple theme',
 *     preview: createColorPreview(['#282a36', '#ff79c6', '#50fa7b']),
 *     onActivated: () => applyPreset('dracula'),
 * });
 */
export function createPresetRow(config) {
    const {
        title,
        subtitle = '',
        preview,
        onActivated,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
        activatable: true,
    });

    if (preview) {
        row.add_prefix(preview);
    }

    const applyIcon = new Gtk.Image({
        icon_name: 'go-next-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['dim-label'],
    });
    row.add_suffix(applyIcon);

    row.connect('activated', onActivated);

    return {row};
}

// ============================================================================
// TOOLBAR/HEADER BUILDERS
// ============================================================================

/**
 * Creates a horizontal toolbar box with buttons
 *
 * @param {Object} config - Configuration options
 * @param {number} [config.spacing=6] - Spacing between buttons
 * @param {number} [config.marginBottom=12] - Bottom margin
 * @param {Gtk.Widget[]} [config.startWidgets=[]] - Widgets at start (expanding)
 * @param {Gtk.Widget[]} [config.endWidgets=[]] - Widgets at end
 * @returns {Gtk.Box} The toolbar box
 *
 * @example
 * const toolbar = createToolbar({
 *     startWidgets: [searchEntry],
 *     endWidgets: [importButton, refreshButton],
 * });
 */
export function createToolbar(config) {
    const {
        spacing = 6,
        marginBottom = 12,
        startWidgets = [],
        endWidgets = [],
    } = config;

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing,
        margin_bottom: marginBottom,
    });

    startWidgets.forEach((widget, index) => {
        if (index === 0) {
            widget.hexpand = true;
        }
        box.append(widget);
    });

    endWidgets.forEach(widget => {
        box.append(widget);
    });

    return box;
}

/**
 * Creates an icon button with optional CSS classes
 *
 * @param {Object} config - Configuration options
 * @param {string} config.iconName - Icon name
 * @param {string} [config.tooltip] - Tooltip text
 * @param {string[]} [config.cssClasses=[]] - CSS classes
 * @param {function(): void} config.onClicked - Click callback
 * @returns {Gtk.Button} The button widget
 *
 * @example
 * const refreshBtn = createIconButton({
 *     iconName: 'view-refresh-symbolic',
 *     tooltip: 'Refresh',
 *     onClicked: () => refresh(),
 * });
 */
export function createIconButton(config) {
    const {
        iconName,
        tooltip,
        cssClasses = [],
        onClicked,
    } = config;

    const button = new Gtk.Button({
        icon_name: iconName,
        css_classes: cssClasses,
    });

    if (tooltip) {
        button.set_tooltip_text(tooltip);
    }

    button.connect('clicked', onClicked);

    return button;
}

/**
 * Creates a group of action buttons in a horizontal box
 *
 * @param {Object} config - Configuration options
 * @param {Array<{iconName: string, tooltip?: string, cssClasses?: string[], onClicked: function}>} config.buttons - Button configurations
 * @param {number} [config.spacing=6] - Spacing between buttons
 * @param {Gtk.Align} [config.valign=Gtk.Align.CENTER] - Vertical alignment
 * @returns {{box: Gtk.Box, buttons: Gtk.Button[]}} Box and button widgets
 *
 * @example
 * const {box, buttons} = createActionButtonGroup({
 *     buttons: [
 *         {iconName: 'document-edit-symbolic', tooltip: 'Edit', onClicked: () => edit()},
 *         {iconName: 'user-trash-symbolic', tooltip: 'Delete', cssClasses: ['error'], onClicked: () => delete()},
 *     ],
 * });
 */
export function createActionButtonGroup(config) {
    const {
        buttons: buttonConfigs,
        spacing = 6,
        valign = Gtk.Align.CENTER,
    } = config;

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing,
        valign,
    });

    const buttons = buttonConfigs.map(cfg => {
        const button = createIconButton(cfg);
        box.append(button);
        return button;
    });

    return {box, buttons};
}

// ============================================================================
// WRAPPER ROW (for embedding custom widgets in ActionRow)
// ============================================================================

/**
 * Creates an Adw.ActionRow that wraps a custom widget
 *
 * @param {Object} config - Configuration options
 * @param {Gtk.Widget} config.child - Widget to wrap
 * @param {Object} [config.margins] - Margin overrides
 * @param {number} [config.margins.start=12] - Start margin
 * @param {number} [config.margins.end=12] - End margin
 * @param {number} [config.margins.top=6] - Top margin
 * @param {number} [config.margins.bottom=6] - Bottom margin
 * @returns {Adw.ActionRow} The action row
 *
 * @example
 * const row = createWrapperRow({
 *     child: myCustomWidget,
 *     margins: { start: 12, end: 12, top: 8, bottom: 8 },
 * });
 * expanderRow.add_row(row);
 */
export function createWrapperRow(config) {
    const {
        child,
        margins = {},
    } = config;

    const {
        start = 12,
        end = 12,
        top = 6,
        bottom = 6,
    } = margins;

    const wrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: start,
        margin_end: end,
        margin_top: top,
        margin_bottom: bottom,
    });

    wrapper.append(child);

    return new Adw.ActionRow({child: wrapper});
}

// ============================================================================
// SEARCH ENTRY
// ============================================================================

/**
 * Creates a search entry with debounced callback
 *
 * @param {Object} config - Configuration options
 * @param {string} [config.placeholder='Search...'] - Placeholder text
 * @param {boolean} [config.hexpand=true] - Whether to expand horizontally
 * @param {number} [config.debounceMs=150] - Debounce delay in milliseconds
 * @param {function(string): void} config.onSearch - Search callback with query text
 * @returns {{entry: Gtk.SearchEntry, getText: function(): string, clear: function(): void}} Entry and helpers
 *
 * @example
 * const {entry, getText, clear} = createSearchEntry({
 *     placeholder: 'Search blueprints...',
 *     onSearch: (query) => filterItems(query),
 * });
 */
export function createSearchEntry(config) {
    const {
        placeholder = 'Search...',
        hexpand = true,
        debounceMs = 150,
        onSearch,
    } = config;

    const entry = new Gtk.SearchEntry({
        placeholder_text: placeholder,
        hexpand,
    });

    let debounceTimeout = null;

    entry.connect('search-changed', () => {
        if (debounceTimeout) {
            GLib.source_remove(debounceTimeout);
        }

        if (debounceMs > 0) {
            debounceTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                debounceMs,
                () => {
                    onSearch(entry.get_text());
                    debounceTimeout = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        } else {
            onSearch(entry.get_text());
        }
    });

    const getText = () => entry.get_text();
    const clear = () => entry.set_text('');

    return {entry, getText, clear};
}

// ============================================================================
// SPINNER ROW
// ============================================================================

/**
 * Creates an Adw.ActionRow with a loading spinner
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title (e.g., 'Loading...')
 * @param {string} [config.subtitle] - Row subtitle
 * @param {boolean} [config.spinning=true] - Initial spinner state
 * @returns {{row: Adw.ActionRow, spinner: Gtk.Spinner, setSpinning: function(boolean): void}} Row and controls
 *
 * @example
 * const {row, setSpinning} = createSpinnerRow({
 *     title: 'Loading wallpapers...',
 * });
 * // Later:
 * setSpinning(false);
 */
export function createSpinnerRow(config) {
    const {
        title,
        subtitle = '',
        spinning = true,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const spinner = new Gtk.Spinner({
        spinning,
        valign: Gtk.Align.CENTER,
    });

    row.add_suffix(spinner);

    const setSpinning = (active) => spinner.set_spinning(active);

    return {row, spinner, setSpinning};
}

// ============================================================================
// ENTRY ROW
// ============================================================================

/**
 * Creates an Adw.ActionRow with a text entry
 *
 * @param {Object} config - Configuration options
 * @param {string} config.title - Row title
 * @param {string} [config.subtitle] - Row subtitle
 * @param {string} [config.text=''] - Initial text
 * @param {string} [config.placeholder=''] - Placeholder text
 * @param {number} [config.widthChars=20] - Entry width in characters
 * @param {boolean} [config.password=false] - Whether to hide text
 * @param {function(string): void} [config.onChanged] - Text change callback
 * @returns {{row: Adw.ActionRow, entry: Gtk.Entry, getText: function, setText: function}} Row and controls
 *
 * @example
 * const {row, getText} = createEntryRow({
 *     title: 'API Key',
 *     placeholder: 'Enter your API key',
 *     password: true,
 *     onChanged: (text) => validateApiKey(text),
 * });
 */
export function createEntryRow(config) {
    const {
        title,
        subtitle = '',
        text = '',
        placeholder = '',
        widthChars = 20,
        password = false,
        onChanged,
    } = config;

    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const entry = new Gtk.Entry({
        text,
        placeholder_text: placeholder,
        width_chars: widthChars,
        valign: Gtk.Align.CENTER,
        visibility: !password,
    });

    if (password) {
        entry.set_input_purpose(Gtk.InputPurpose.PASSWORD);
    }

    if (onChanged) {
        entry.connect('changed', () => {
            onChanged(entry.get_text());
        });
    }

    row.add_suffix(entry);

    const getText = () => entry.get_text();
    const setText = (newText) => entry.set_text(newText);

    return {row, entry, getText, setText};
}
