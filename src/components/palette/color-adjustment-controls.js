import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {ADJUSTMENT_LIMITS} from '../../constants/colors.js';

/**
 * Creates color adjustment controls (sliders for vibrance, contrast, etc.)
 */
export class ColorAdjustmentControls {
    constructor(onAdjustmentChange, onReset) {
        this.onAdjustmentChange = onAdjustmentChange;
        this.onReset = onReset;
        this._debounceTimeout = null;

        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            visible: true,
        });

        this._createControls();
    }

    _createControls() {
        // Create vertical box for sliders
        const slidersBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            homogeneous: true,
        });

        // Vibrance
        const vibranceSlider = this._createCompactSlider({
            label: 'Vibrance',
            min: ADJUSTMENT_LIMITS.vibrance.min,
            max: ADJUSTMENT_LIMITS.vibrance.max,
            defaultValue: ADJUSTMENT_LIMITS.vibrance.default,
            step: ADJUSTMENT_LIMITS.vibrance.step,
            onChange: () => this._emitChange(),
        });
        this.vibranceScale = vibranceSlider.scale;
        slidersBox.append(vibranceSlider.box);

        // Contrast
        const contrastSlider = this._createCompactSlider({
            label: 'Contrast',
            min: ADJUSTMENT_LIMITS.contrast.min,
            max: ADJUSTMENT_LIMITS.contrast.max,
            defaultValue: ADJUSTMENT_LIMITS.contrast.default,
            step: ADJUSTMENT_LIMITS.contrast.step,
            onChange: () => this._emitChange(),
        });
        this.contrastScale = contrastSlider.scale;
        slidersBox.append(contrastSlider.box);

        // Brightness
        const brightnessSlider = this._createCompactSlider({
            label: 'Brightness',
            min: ADJUSTMENT_LIMITS.brightness.min,
            max: ADJUSTMENT_LIMITS.brightness.max,
            defaultValue: ADJUSTMENT_LIMITS.brightness.default,
            step: ADJUSTMENT_LIMITS.brightness.step,
            onChange: () => this._emitChange(),
        });
        this.brightnessScale = brightnessSlider.scale;
        slidersBox.append(brightnessSlider.box);

        // Hue Shift
        const hueSlider = this._createCompactSlider({
            label: 'Hue Shift',
            min: ADJUSTMENT_LIMITS.hue.min,
            max: ADJUSTMENT_LIMITS.hue.max,
            defaultValue: ADJUSTMENT_LIMITS.hue.default,
            step: ADJUSTMENT_LIMITS.hue.step,
            onChange: () => this._emitChange(),
        });
        this.hueScale = hueSlider.scale;
        slidersBox.append(hueSlider.box);

        // Temperature
        const temperatureSlider = this._createCompactSlider({
            label: 'Temperature',
            min: ADJUSTMENT_LIMITS.temperature.min,
            max: ADJUSTMENT_LIMITS.temperature.max,
            defaultValue: ADJUSTMENT_LIMITS.temperature.default,
            step: ADJUSTMENT_LIMITS.temperature.step,
            onChange: () => this._emitChange(),
        });
        this.temperatureScale = temperatureSlider.scale;
        slidersBox.append(temperatureSlider.box);

        // Gamma
        const gammaSlider = this._createCompactSlider({
            label: 'Gamma',
            min: ADJUSTMENT_LIMITS.gamma.min,
            max: ADJUSTMENT_LIMITS.gamma.max,
            defaultValue: ADJUSTMENT_LIMITS.gamma.default,
            step: ADJUSTMENT_LIMITS.gamma.step,
            onChange: () => this._emitChange(),
        });
        this.gammaScale = gammaSlider.scale;
        slidersBox.append(gammaSlider.box);

        this.widget.append(slidersBox);

        // Reset button
        const resetButton = new Gtk.Button({
            label: 'Reset Adjustments',
            halign: Gtk.Align.CENTER,
            margin_top: 8,
        });
        resetButton.connect('clicked', () => {
            this.reset();
            if (this.onReset) {
                this.onReset();
            }
        });
        this.widget.append(resetButton);
    }

    _createCompactSlider(config) {
        const {label, min, max, defaultValue, step, onChange} = config;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: true,
        });

        const labelWidget = new Gtk.Label({
            label,
            xalign: 0,
            css_classes: ['caption'],
            width_request: 90,
        });

        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                value: defaultValue,
                step_increment: step,
            }),
            draw_value: false,
            digits: 1,
            hexpand: true,
            width_request: 150,
        });

        // Create a stack to switch between label and entry
        const valueStack = new Gtk.Stack({
            width_request: 50,
        });

        const valueLabel = new Gtk.Label({
            label: defaultValue.toFixed(1),
            xalign: 1,
            css_classes: ['caption', 'monospace'],
        });

        const valueEntry = new Gtk.Entry({
            text: defaultValue.toFixed(1),
            xalign: 1,
            width_chars: 5,
            max_width_chars: 5,
        });

        valueStack.add_named(valueLabel, 'label');
        valueStack.add_named(valueEntry, 'entry');
        valueStack.set_visible_child_name('label');

        // Helper to apply entry value to scale
        const applyEntryValue = () => {
            const value = parseFloat(valueEntry.get_text());
            if (!isNaN(value)) {
                const clampedValue = Math.max(min, Math.min(max, value));
                scale.set_value(clampedValue);
            }
        };

        // Helper to switch back to label view
        const exitEditMode = () => {
            valueEntry.set_text(scale.get_value().toFixed(1));
            valueStack.set_visible_child_name('label');
        };

        // Update displays when scale changes
        scale.connect('value-changed', () => {
            const value = scale.get_value().toFixed(1);
            valueLabel.set_label(value);
            valueEntry.set_text(value);
            if (onChange) onChange();
        });

        // Click on label to edit
        const labelGesture = new Gtk.GestureClick();
        labelGesture.connect('pressed', () => {
            valueStack.set_visible_child_name('entry');
            valueEntry.grab_focus();
            valueEntry.select_region(0, -1);
        });
        valueLabel.add_controller(labelGesture);

        // Enter applies value
        valueEntry.connect('activate', () => {
            applyEntryValue();
            exitEditMode();
        });

        // Escape cancels editing
        const entryKeyController = Gtk.EventControllerKey.new();
        entryKeyController.connect('key-pressed', (controller, keyval) => {
            if (keyval === Gdk.KEY_Escape) {
                exitEditMode();
                return true;
            }
            return false;
        });
        valueEntry.add_controller(entryKeyController);

        // Focus loss applies value
        const focusController = Gtk.EventControllerFocus.new();
        focusController.connect('leave', () => {
            if (valueStack.get_visible_child_name() === 'entry') {
                applyEntryValue();
                exitEditMode();
            }
        });
        valueEntry.add_controller(focusController);

        // Double-click scale to reset to default
        let clickCount = 0;
        let clickTimeout = null;

        const scaleClickController = new Gtk.EventControllerLegacy();
        scaleClickController.connect('event', (controller, event) => {
            if (event.get_event_type() === Gdk.EventType.BUTTON_PRESS) {
                clickCount++;

                if (clickTimeout) GLib.source_remove(clickTimeout);

                clickTimeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    300,
                    () => {
                        if (clickCount === 2) {
                            scale.set_value(defaultValue);
                        }
                        clickCount = 0;
                        clickTimeout = null;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            }
            return false;
        });
        scale.add_controller(scaleClickController);

        box.append(labelWidget);
        box.append(scale);
        box.append(valueStack);

        return {box, scale};
    }

    _emitChange() {
        // Debounce: wait 150ms after user stops dragging before applying changes
        if (this._debounceTimeout) {
            GLib.source_remove(this._debounceTimeout);
        }

        this._debounceTimeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            150,
            () => {
                if (this.onAdjustmentChange) {
                    this.onAdjustmentChange(this.getValues());
                }
                this._debounceTimeout = null;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    getValues() {
        return {
            vibrance: this.vibranceScale.get_value(),
            contrast: this.contrastScale.get_value(),
            brightness: this.brightnessScale.get_value(),
            hueShift: this.hueScale.get_value(),
            temperature: this.temperatureScale.get_value(),
            gamma: this.gammaScale.get_value(),
        };
    }

    reset() {
        this.vibranceScale.set_value(ADJUSTMENT_LIMITS.vibrance.default);
        this.contrastScale.set_value(ADJUSTMENT_LIMITS.contrast.default);
        this.brightnessScale.set_value(ADJUSTMENT_LIMITS.brightness.default);
        this.hueScale.set_value(ADJUSTMENT_LIMITS.hue.default);
        this.temperatureScale.set_value(ADJUSTMENT_LIMITS.temperature.default);
        this.gammaScale.set_value(ADJUSTMENT_LIMITS.gamma.default);
    }
}
