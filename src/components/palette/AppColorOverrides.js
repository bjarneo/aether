import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {getAppNameFromFileName} from '../../constants/templates.js';
import {
    getTemplateMap,
    resolveTemplatePath,
    getCustomApps,
} from '../../utils/template-utils.js';
import {SPACING} from '../../constants/ui-constants.js';
import {rgbaToHex} from '../../utils/color-utils.js';

// Files excluded from per-app overrides (internal templates or terminal configs handled elsewhere)
const EXCLUDED_TEMPLATE_FILES = [
    'aether.override.css',
    'gtk.css',
    'alacritty.toml',
    'ghostty.conf',
    'kitty.conf',
    'btop.theme',
];

export const AppColorOverrides = GObject.registerClass(
    {
        Signals: {
            'overrides-changed': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class AppColorOverrides extends Adw.ExpanderRow {
        _init() {
            super._init({
                title: 'Advanced: Per-Application Overrides',
                subtitle: 'Customize colors for specific applications',
                icon_name: 'applications-science-symbolic',
                show_enable_switch: false,
            });

            // Store overrides: { appName: { colorVar: colorValue } }
            this._overrides = {};

            // Store current palette colors (from main palette)
            this._paletteColors = {};

            // Store references to count labels for each app
            this._countLabels = new Map();

            // Store references to app rows for conditional visibility
            this._appRows = new Map();

            // Store references to color buttons for palette updates
            // Format: Map<appName, Map<colorVar, {button, row, isResetting}>>
            this._colorButtons = new Map();

            // Track if a Neovim theme is selected
            this._neovimThemeSelected = false;

            // Get list of template files (excluding aether.override.css and gtk.css)
            this._apps = this._getAvailableApps();

            this._initializeUI();
        }

        _getAvailableApps() {
            const templateMap = getTemplateMap();
            const apps = [];
            const addedApps = new Set();

            templateMap.forEach((filePath, fileName) => {
                if (EXCLUDED_TEMPLATE_FILES.includes(fileName)) {
                    return;
                }

                // We only care about the file name for app identification
                const appName = this._getAppNameFromFileName(fileName);
                const label = this._getAppLabelFromFileName(fileName);

                apps.push({
                    name: appName,
                    label: label,
                    file: fileName,
                    templatePath: filePath,
                });
                addedApps.add(appName);
            });

            // Add custom apps from ~/.config/aether/custom/
            const customApps = getCustomApps();
            customApps.forEach(customApp => {
                // Skip if already added (avoid duplicates)
                if (addedApps.has(customApp.name)) {
                    return;
                }

                apps.push({
                    name: customApp.name,
                    label: customApp.label,
                    file: null,
                    templatePath: customApp.templatePath,
                });
                addedApps.add(customApp.name);
            });

            // Sort alphabetically by label
            apps.sort((a, b) => a.label.localeCompare(b.label));

            return apps;
        }

        _getAppNameFromFileName(fileName) {
            return getAppNameFromFileName(fileName);
        }

        _getAppLabelFromFileName(fileName) {
            // Create human-readable labels
            const appName = this._getAppNameFromFileName(fileName);
            return appName.charAt(0).toUpperCase() + appName.slice(1);
        }

        _getUsedColorVariables(app) {
            // Get template path - use templatePath if available, otherwise resolve from fileName
            const templatePath =
                app.templatePath || resolveTemplatePath(app.file);

            try {
                const file = Gio.File.new_for_path(templatePath);
                const [success, contents] = file.load_contents(null);
                if (!success) {
                    return [];
                }

                const text = new TextDecoder('utf-8').decode(contents);
                const colorVars = new Set();

                // Match patterns like {background}, {foreground}, {color0}, etc.
                // Also match descriptive names: {red}, {bright_red}, {blue}, etc.
                // Also match {color0.strip}, {color0.rgb}, {color0.rgba}, {color0.yaru}
                // And match {color.rgba:0.5} format
                const regex =
                    /\{(background|foreground|color\d+|black|red|green|yellow|blue|magenta|cyan|white|bright_black|bright_red|bright_green|bright_yellow|bright_blue|bright_magenta|bright_cyan|bright_white)(?:\.[a-z]+)?(?::\d*\.?\d+)?\}/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    colorVars.add(match[1]); // Add just the variable name without modifiers
                }

                // Convert to sorted array
                const varsArray = Array.from(colorVars);

                // Custom sort: background first, foreground second, then colors
                const colorOrder = [
                    'background',
                    'foreground',
                    'black',
                    'red',
                    'green',
                    'yellow',
                    'blue',
                    'magenta',
                    'cyan',
                    'white',
                    'bright_black',
                    'bright_red',
                    'bright_green',
                    'bright_yellow',
                    'bright_blue',
                    'bright_magenta',
                    'bright_cyan',
                    'bright_white',
                    'color0',
                    'color1',
                    'color2',
                    'color3',
                    'color4',
                    'color5',
                    'color6',
                    'color7',
                    'color8',
                    'color9',
                    'color10',
                    'color11',
                    'color12',
                    'color13',
                    'color14',
                    'color15',
                ];
                varsArray.sort((a, b) => {
                    const aIndex = colorOrder.indexOf(a);
                    const bIndex = colorOrder.indexOf(b);
                    if (aIndex === -1 && bIndex === -1)
                        return a.localeCompare(b);
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                });

                return varsArray;
            } catch (e) {
                console.error(
                    `Error reading template for ${app.name}:`,
                    e.message
                );
                return [];
            }
        }

        _getColorVarLabel(colorVar, appName) {
            // App-specific color descriptions showing what each color does in that template
            const colorDescriptionsByApp = {
                hyprland: {
                    black: 'Active window border gradient start',
                    bright_black: 'Active window border gradient end',
                },
                hyprlock: {
                    background: 'Screen and input field background',
                    foreground: 'Text and placeholder color',
                    magenta: 'Outer ring color',
                    cyan: 'Password check indicator color',
                },
                waybar: {
                    background: 'Bar background color',
                    foreground: 'Text and icon color',
                    black: 'Black',
                    red: 'Red',
                    green: 'Green',
                    yellow: 'Yellow',
                    blue: 'Blue',
                    magenta: 'Magenta',
                    cyan: 'Cyan',
                    white: 'White',
                    bright_black: 'Bright black',
                    bright_red: 'Bright red',
                    bright_green: 'Bright green',
                    bright_yellow: 'Bright yellow',
                    bright_blue: 'Bright blue',
                    bright_magenta: 'Bright magenta',
                    bright_cyan: 'Bright cyan',
                    bright_white: 'Bright white',
                },
                mako: {
                    foreground: 'Notification text color',
                    magenta: 'Notification border color',
                    background: 'Notification background color',
                },
                walker: {
                    foreground: 'Text color',
                    background: 'Window and input background',
                    blue: 'Selected item highlight color',
                    bright_black: 'Border and scrollbar color',
                },
                wofi: {
                    background: 'Window and entry background',
                    foreground: 'Text and icon color',
                    green: 'Input and entry selected background',
                    bright_black: 'Window border and scrollbar',
                    blue: 'Window border color',
                    yellow: 'Scrollbar hover color',
                    magenta: 'Unused color variable',
                    bright_white: 'Selected text bright color',
                },
                swayosd: {
                    background: 'OSD background color',
                    bright_black: 'OSD border color',
                    foreground: 'OSD label and icon color',
                    yellow: 'OSD progress bar color',
                },
                chromium: {
                    background: 'Browser theme background color',
                },
                icons: {
                    magenta: 'System icon accent color',
                },
                neovim: {
                    background: 'Editor background',
                    foreground:
                        'Object properties, builtin types, builtin variables, member access, default text',
                    red: 'Errors, diagnostics, tags, deletions, breakpoints',
                    green: 'Comments, strings, success states, git additions',
                    yellow: 'Types, classes, constructors, warnings, numbers, booleans',
                    blue: 'Functions, keywords, directories, links, info diagnostics',
                    magenta:
                        'Storage keywords, special keywords, identifiers, namespaces',
                    cyan: 'Parameters, regex, preprocessor, hints, properties',
                    white: 'Inactive elements, statusline, secondary text',
                    bright_black:
                        'Line highlight, gutter elements, disabled states',
                    bright_red:
                        'Constants, numbers, current line number, git modifications',
                    bright_magenta:
                        'Function declarations, exception handling, tags',
                },
            };

            // Get app-specific description if available
            if (
                appName &&
                colorDescriptionsByApp[appName] &&
                colorDescriptionsByApp[appName][colorVar]
            ) {
                return colorDescriptionsByApp[appName][colorVar];
            }

            // Fallback to generic color names
            const genericLabelMap = {
                background: 'Background',
                foreground: 'Foreground',
                color0: 'Black (0)',
                black: 'Black (0)',
                color1: 'Red (1)',
                red: 'Red (1)',
                color2: 'Green (2)',
                green: 'Green (2)',
                color3: 'Yellow (3)',
                yellow: 'Yellow (3)',
                color4: 'Blue (4)',
                blue: 'Blue (4)',
                color5: 'Magenta (5)',
                magenta: 'Magenta (5)',
                color6: 'Cyan (6)',
                cyan: 'Cyan (6)',
                color7: 'White (7)',
                white: 'White (7)',
                color8: 'Bright Black (8)',
                bright_black: 'Bright Black (8)',
                color9: 'Bright Red (9)',
                bright_red: 'Bright Red (9)',
                color10: 'Bright Green (10)',
                bright_green: 'Bright Green (10)',
                color11: 'Bright Yellow (11)',
                bright_yellow: 'Bright Yellow (11)',
                color12: 'Bright Blue (12)',
                bright_blue: 'Bright Blue (12)',
                color13: 'Bright Magenta (13)',
                bright_magenta: 'Bright Magenta (13)',
                color14: 'Bright Cyan (14)',
                bright_cyan: 'Bright Cyan (14)',
                color15: 'Bright White (15)',
                bright_white: 'Bright White (15)',
            };

            return genericLabelMap[colorVar] || colorVar;
        }

        _initializeUI() {
            // Help text at the top
            const helpRow = new Adw.ActionRow({
                title: 'Override specific colors for individual applications',
            });
            const helpLabel = new Gtk.Label({
                label: 'Click an application to customize its color mappings',
                css_classes: ['dim-label', 'caption'],
                wrap: true,
                xalign: 0,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
            });
            this.add_row(helpLabel);

            // Create list of applications
            this._apps.forEach(app => {
                const appRow = this._createAppRow(app);
                this.add_row(appRow);
            });

            // Reset all button at the bottom
            const resetButton = new Gtk.Button({
                label: 'Reset All Overrides',
                css_classes: ['destructive-action'],
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: 12,
                margin_end: 12,
            });
            resetButton.connect('clicked', () => this._resetAllOverrides());
            this.add_row(resetButton);
        }

        _createAppRow(app) {
            const row = new Adw.ActionRow({
                title: app.label,
                subtitle: app.file,
                activatable: true,
            });

            // Hide neovim row if theme is selected
            if (app.name === 'neovim' && this._neovimThemeSelected) {
                row.set_visible(false);
            }

            // Count indicator - shows number of overrides for this app
            const countLabel = new Gtk.Label({
                css_classes: ['dim-label', 'caption'],
                valign: Gtk.Align.CENTER,
            });
            this._updateCountLabel(countLabel, app.name);
            row.add_suffix(countLabel);

            // Store reference to count label and row
            this._countLabels.set(app.name, countLabel);
            this._appRows.set(app.name, row);

            // Arrow icon
            const arrow = new Gtk.Image({
                icon_name: 'go-next-symbolic',
                valign: Gtk.Align.CENTER,
            });
            row.add_suffix(arrow);

            row.connect('activated', () => {
                this._showOverrideDialog(app, countLabel);
            });

            return row;
        }

        _updateCountLabel(label, appName) {
            const count = this._overrides[appName]
                ? Object.keys(this._overrides[appName]).length
                : 0;
            if (count > 0) {
                label.set_label(`${count} override${count > 1 ? 's' : ''}`);
                label.set_visible(true);
            } else {
                label.set_visible(false);
            }
        }

        _showOverrideDialog(app, countLabel) {
            const dialog = new Adw.Dialog({
                title: `${app.label} Color Overrides`,
                content_width: 600,
                content_height: 500,
            });

            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: 12,
                margin_end: 12,
            });

            // Description
            const desc = new Gtk.Label({
                label: `Override color variables for ${app.label}. These will take precedence over the default palette colors.`,
                wrap: true,
                xalign: 0,
                css_classes: ['dim-label'],
                margin_bottom: 6,
            });
            content.append(desc);

            // Scrolled window for overrides list
            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });

            const overridesGroup = new Adw.PreferencesGroup({
                title: 'Color Variable Overrides',
            });

            // Get current overrides for this app
            const appOverrides = this._overrides[app.name] || {};

            // Get color variables used in this template
            const colorVars = this._getUsedColorVariables(app);

            console.log(`Used variables for ${app.name}:`, colorVars);

            if (colorVars.length === 0) {
                const emptyLabel = new Gtk.Label({
                    label: 'No color variables found in this template',
                    css_classes: ['dim-label'],
                    margin_top: SPACING.MD,
                    margin_bottom: SPACING.MD,
                });
                overridesGroup.add(emptyLabel);
            } else {
                // Create rows for each color variable used in the template
                colorVars.forEach(colorVar => {
                    const row = this._createColorOverrideRow(
                        colorVar,
                        appOverrides[colorVar] || null,
                        newColor => {
                            this._updateOverride(app.name, colorVar, newColor);
                            this._updateCountLabel(countLabel, app.name);
                        },
                        app.name
                    );
                    overridesGroup.add(row);
                });
            }

            scrolled.set_child(overridesGroup);
            content.append(scrolled);

            // Button row
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_top: SPACING.MD,
                halign: Gtk.Align.END,
            });

            const resetAppButton = new Gtk.Button({
                label: 'Reset All',
                css_classes: ['destructive-action'],
            });
            resetAppButton.connect('clicked', () => {
                this._resetAppOverrides(app.name);
                this._updateCountLabel(countLabel, app.name);
                dialog.close();
            });

            const doneButton = new Gtk.Button({
                label: 'Done',
                css_classes: ['suggested-action'],
            });
            doneButton.connect('clicked', () => dialog.close());

            buttonBox.append(resetAppButton);
            buttonBox.append(doneButton);
            content.append(buttonBox);

            dialog.set_child(content);
            dialog.present(this.get_root());
        }

        _createColorOverrideRow(
            colorVar,
            currentValue,
            onColorChanged,
            appName
        ) {
            const row = new Adw.ActionRow({
                title: this._getColorVarLabel(colorVar, appName),
                subtitle: currentValue
                    ? `Custom: ${currentValue}`
                    : 'Using default',
            });

            // Color button
            const colorButton = new Gtk.ColorDialogButton({
                valign: Gtk.Align.CENTER,
                dialog: new Gtk.ColorDialog(),
            });

            // Track if we're programmatically changing the color
            let isResetting = false;

            // Set initial color: use override if exists, otherwise use palette color
            const displayColor =
                currentValue || this._paletteColors[colorVar] || '#808080';
            const rgba = new Gdk.RGBA();
            rgba.parse(displayColor);
            colorButton.set_rgba(rgba);

            // Clear button
            const clearButton = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Clear override',
                css_classes: ['flat'],
                visible: currentValue !== null,
            });

            // Color change handler
            colorButton.connect('notify::rgba', () => {
                if (isResetting) {
                    return; // Skip if we're resetting to default
                }

                const rgba = colorButton.get_rgba();
                const hex = rgbaToHex(rgba);
                row.set_subtitle(`Custom: ${hex}`);
                onColorChanged(hex);
                clearButton.set_visible(true);
            });

            row.add_suffix(colorButton);

            clearButton.connect('clicked', () => {
                isResetting = true;
                onColorChanged(null);
                row.set_subtitle('Using default');
                clearButton.set_visible(false);

                // Reset color button to default palette color
                const defaultColor = this._paletteColors[colorVar] || '#808080';
                const defaultRgba = new Gdk.RGBA();
                defaultRgba.parse(defaultColor);
                colorButton.set_rgba(defaultRgba);

                isResetting = false;
            });

            row.add_suffix(clearButton);

            // Store button reference for later updates
            if (!this._colorButtons.has(appName)) {
                this._colorButtons.set(appName, new Map());
            }
            this._colorButtons.get(appName).set(colorVar, {
                button: colorButton,
                row: row,
                clearButton: clearButton,
                get isResetting() {
                    return isResetting;
                },
                set isResetting(value) {
                    isResetting = value;
                },
            });

            return row;
        }

        _updateOverride(appName, colorVar, value) {
            if (!this._overrides[appName]) {
                this._overrides[appName] = {};
            }

            if (value === null) {
                delete this._overrides[appName][colorVar];
                // Clean up empty app entries
                if (Object.keys(this._overrides[appName]).length === 0) {
                    delete this._overrides[appName];
                }
            } else {
                this._overrides[appName][colorVar] = value;
            }

            this.emit('overrides-changed', this._overrides);
        }

        _resetAppOverrides(appName) {
            delete this._overrides[appName];
            this.emit('overrides-changed', this._overrides);
        }

        _resetAllOverrides() {
            this._overrides = {};

            // Update all count labels
            this._countLabels.forEach((countLabel, appName) => {
                this._updateCountLabel(countLabel, appName);
            });

            this.emit('overrides-changed', this._overrides);
        }

        resetAllOverrides() {
            this._resetAllOverrides();
        }

        getOverrides() {
            return this._overrides;
        }

        /**
         * Set overrides and emit change signal
         * @param {Object} overrides - App override mappings
         */
        setOverrides(overrides) {
            this._overrides = overrides || {};
            this.emit('overrides-changed', this._overrides);
        }

        /**
         * Load overrides from blueprint without emitting signal
         * Used when restoring state from ThemeState to avoid signal loops
         * @param {Object} overrides - App override mappings
         */
        loadFromBlueprint(overrides) {
            this._overrides = overrides || {};
            this._countLabels.forEach((countLabel, appName) => {
                this._updateCountLabel(countLabel, appName);
            });
        }

        setPaletteColors(colors) {
            // Update the palette colors from ColorSynthesizer
            this._paletteColors = colors || {};

            // Update all existing color buttons to show new palette colors
            // (but only if they don't have a custom override)
            this._colorButtons.forEach((colorVarMap, appName) => {
                colorVarMap.forEach((buttonData, colorVar) => {
                    const {button, row, clearButton, isResetting} = buttonData;

                    // Skip if this color has a custom override
                    const hasOverride = this._overrides[appName]?.[colorVar];
                    if (hasOverride) {
                        return;
                    }

                    // Update button to show new palette color
                    buttonData.isResetting = true;
                    const newColor = this._paletteColors[colorVar] || '#808080';
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newColor);
                    button.set_rgba(rgba);
                    buttonData.isResetting = false;

                    // Update subtitle if using default
                    if (!hasOverride) {
                        row.set_subtitle('Using default');
                    }
                });
            });
        }

        setNeovimThemeSelected(selected) {
            // Update visibility of neovim row based on theme selection
            this._neovimThemeSelected = selected;
            const neovimRow = this._appRows.get('neovim');
            if (neovimRow) {
                neovimRow.set_visible(!selected);
            }
        }
    }
);
