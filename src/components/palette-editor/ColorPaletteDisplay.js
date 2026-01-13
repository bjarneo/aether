import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget, showToast} from '../../utils/ui-helpers.js';
import {ANSI_COLOR_NAMES} from '../../constants/colors.js';
import {themeState} from '../../state/ThemeState.js';

/**
 * ColorPaletteDisplay - Modern color palette grid with visual hierarchy
 * Features split display of normal and bright colors
 */
export const ColorPaletteDisplay = GObject.registerClass(
    {
        Signals: {
            'color-clicked': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_STRING],
            },
            'color-locked': {param_types: [GObject.TYPE_INT, GObject.TYPE_BOOLEAN]},
        },
    },
    class ColorPaletteDisplay extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
            });

            this._palette = themeState.getPalette();
            this._lockedColors = new Array(16).fill(false);

            this._buildUI();
            this._connectThemeState();
        }

        _connectThemeState() {
            themeState.connect('palette-changed', (_, palette) => {
                if (JSON.stringify(palette) !== JSON.stringify(this._palette)) {
                    this._palette = [...palette];
                    this._updateSwatches();
                }
            });

            themeState.connect('state-reset', () => {
                this._lockedColors = new Array(16).fill(false);
                this._updateSwatches();
            });
        }

        _buildUI() {
            // Header
            const header = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const title = new Gtk.Label({
                label: 'Color Palette',
                xalign: 0,
                hexpand: true,
            });
            applyCssToWidget(
                title,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.7;
                }
            `
            );
            header.append(title);

            // Hint text
            const hint = new Gtk.Label({
                label: 'Click to edit · Right-click to copy',
                css_classes: ['dim-label'],
            });
            applyCssToWidget(
                hint,
                `
                label {
                    font-size: 11px;
                    opacity: 0.5;
                }
            `
            );
            header.append(hint);

            this.append(header);

            // Palette container
            const paletteContainer = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 2,
            });

            // Normal colors row (0-7)
            this._normalRow = this._createColorRow('Normal', 0, 8);
            paletteContainer.append(this._normalRow);

            // Bright colors row (8-15)
            this._brightRow = this._createColorRow('Bright', 8, 16);
            paletteContainer.append(this._brightRow);

            this.append(paletteContainer);

            // Color role legend (compact)
            const legend = this._createLegend();
            this.append(legend);
        }

        _createColorRow(label, startIndex, endIndex) {
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
            });

            // Row label
            const rowLabel = new Gtk.Label({
                label: label,
                xalign: 0,
            });
            applyCssToWidget(
                rowLabel,
                `
                label {
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    opacity: 0.4;
                    margin-left: 2px;
                }
            `
            );
            container.append(rowLabel);

            // Swatches grid
            const grid = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 2,
                homogeneous: true,
            });

            for (let i = startIndex; i < endIndex; i++) {
                const swatch = this._createSwatch(i);
                grid.append(swatch);
            }

            container.append(grid);

            return container;
        }

        _createSwatch(index) {
            const color = this._palette[index] || '#1e1e2e';
            const isLocked = this._lockedColors[index];
            const colorName = ANSI_COLOR_NAMES[index] || `Color ${index}`;

            // Overlay for swatch + lock button
            const overlay = new Gtk.Overlay({
                hexpand: true,
            });

            // Color box
            const swatch = new Gtk.Box({
                height_request: 48,
                hexpand: true,
                tooltip_text: `${colorName}\n${color}`,
            });

            const borderStyle = isLocked
                ? '2px solid @accent_bg_color'
                : '1px solid alpha(@borders, 0.2)';

            applyCssToWidget(
                swatch,
                `
                box {
                    background-color: ${color};
                    border-radius: 0;
                    border: ${borderStyle};
                }
                box:hover {
                    border: 2px solid alpha(white, 0.8);
                }
            `
            );
            swatch.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

            // Store reference for updates
            swatch._colorIndex = index;
            overlay.set_child(swatch);

            // Lock button (appears on hover)
            const lockBtn = new Gtk.Button({
                icon_name: isLocked
                    ? 'changes-prevent-symbolic'
                    : 'changes-allow-symbolic',
                halign: Gtk.Align.END,
                valign: Gtk.Align.START,
                margin_top: 2,
                margin_end: 2,
                opacity: isLocked ? 1.0 : 0.0,
                css_classes: ['circular', 'flat'],
                tooltip_text: isLocked ? 'Unlock color' : 'Lock color',
            });
            applyCssToWidget(
                lockBtn,
                `
                button {
                    background-color: alpha(@window_bg_color, 0.95);
                    min-width: 20px;
                    min-height: 20px;
                    padding: 2px;
                    border-radius: 0;
                }
            `
            );

            lockBtn.connect('clicked', () => {
                this._toggleLock(index);
            });
            overlay.add_overlay(lockBtn);

            // Hover controller
            const hoverController = new Gtk.EventControllerMotion();
            hoverController.connect('enter', () => {
                lockBtn.set_opacity(1.0);
            });
            hoverController.connect('leave', () => {
                lockBtn.set_opacity(this._lockedColors[index] ? 1.0 : 0.0);
            });
            overlay.add_controller(hoverController);

            // Click handler
            const clickGesture = new Gtk.GestureClick();
            clickGesture.connect('pressed', () => {
                if (!this._lockedColors[index]) {
                    this.emit('color-clicked', index, this._palette[index]);
                }
            });
            swatch.add_controller(clickGesture);

            // Right-click for copy
            const rightClick = new Gtk.GestureClick({
                button: Gdk.BUTTON_SECONDARY,
            });
            rightClick.connect('pressed', () => {
                this._copyColor(index);
            });
            swatch.add_controller(rightClick);

            return overlay;
        }

        _createLegend() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 16,
                margin_top: 8,
            });

            // Key roles
            const roles = [
                {index: 0, name: 'BG'},
                {index: 7, name: 'FG'},
                {index: 1, name: 'Red'},
                {index: 2, name: 'Green'},
                {index: 3, name: 'Yellow'},
                {index: 4, name: 'Blue'},
                {index: 5, name: 'Magenta'},
                {index: 6, name: 'Cyan'},
            ];

            roles.forEach(role => {
                const item = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 4,
                });

                const dot = new Gtk.Box({
                    width_request: 8,
                    height_request: 8,
                    valign: Gtk.Align.CENTER,
                });
                applyCssToWidget(
                    dot,
                    `
                    box {
                        background-color: ${this._palette[role.index] || '#888'};
                        border-radius: 0;
                    }
                `
                );
                item.append(dot);

                const label = new Gtk.Label({
                    label: role.name,
                    css_classes: ['dim-label'],
                });
                applyCssToWidget(
                    label,
                    `
                    label {
                        font-size: 10px;
                        opacity: 0.6;
                    }
                `
                );
                item.append(label);

                box.append(item);
            });

            return box;
        }

        _toggleLock(index) {
            this._lockedColors[index] = !this._lockedColors[index];
            this.emit('color-locked', index, this._lockedColors[index]);
            this._updateSwatches();
        }

        _copyColor(index) {
            const color = this._palette[index];
            const display = Gdk.Display.get_default();
            const clipboard = display.get_clipboard();

            const value = new GObject.Value();
            value.init(GObject.TYPE_STRING);
            value.set_string(color);

            const contentProvider = Gdk.ContentProvider.new_for_value(value);
            clipboard.set_content(contentProvider);

            const colorName = ANSI_COLOR_NAMES[index] || `Color ${index}`;
            showToast(this, `Copied ${color}`);
        }

        _updateSwatches() {
            // Simply rebuild the entire UI - safer and avoids widget traversal issues
            this._rebuildColorRows();
        }

        _rebuildColorRows() {
            // Get the grid containers (second child of each row - after the label)
            const normalGrid = this._normalRow.get_last_child();
            const brightGrid = this._brightRow.get_last_child();

            // Clear and rebuild normal colors
            this._clearGrid(normalGrid);
            for (let i = 0; i < 8; i++) {
                const swatch = this._createSwatch(i);
                normalGrid.append(swatch);
            }

            // Clear and rebuild bright colors
            this._clearGrid(brightGrid);
            for (let i = 8; i < 16; i++) {
                const swatch = this._createSwatch(i);
                brightGrid.append(swatch);
            }
        }

        _clearGrid(grid) {
            let child = grid.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                grid.remove(child);
                child = next;
            }
        }

        setPalette(colors) {
            this._palette = [...colors];
            this._updateSwatches();
        }

        getPalette() {
            return [...this._palette];
        }

        getLockedColors() {
            return [...this._lockedColors];
        }

        setLockedColors(locked) {
            this._lockedColors = [...locked];
            this._updateSwatches();
        }

        updateColor(index, color) {
            this._palette[index] = color;
            this._updateSwatches();
        }

        reset() {
            this._lockedColors = new Array(16).fill(false);
            this._updateSwatches();
        }
    }
);
