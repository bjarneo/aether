import Gtk from 'gi://Gtk?version=4.0';

import { ADJUSTMENT_LIMITS } from '../../constants/colors.js';

/**
 * Creates color adjustment controls (sliders for vibrance, contrast, etc.)
 */
export class ColorAdjustmentControls {
    constructor(onAdjustmentChange, onReset) {
        this.onAdjustmentChange = onAdjustmentChange;
        this.onReset = onReset;

        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 4,
            margin_bottom: 4,
            visible: false,
        });

        this._createControls();
    }

    _createControls() {
        // Create 2x3 grid for sliders
        const grid = new Gtk.Grid({
            row_spacing: 4,
            column_spacing: 8,
            column_homogeneous: true,
        });

        // Row 1: Vibrance & Contrast
        const vibranceSlider = this._createCompactSlider({
            label: 'Vibrance',
            min: ADJUSTMENT_LIMITS.vibrance.min,
            max: ADJUSTMENT_LIMITS.vibrance.max,
            defaultValue: ADJUSTMENT_LIMITS.vibrance.default,
            step: ADJUSTMENT_LIMITS.vibrance.step,
            onChange: () => this._emitChange(),
        });
        this.vibranceScale = vibranceSlider.scale;
        grid.attach(vibranceSlider.box, 0, 0, 1, 1);

        const contrastSlider = this._createCompactSlider({
            label: 'Contrast',
            min: ADJUSTMENT_LIMITS.contrast.min,
            max: ADJUSTMENT_LIMITS.contrast.max,
            defaultValue: ADJUSTMENT_LIMITS.contrast.default,
            step: ADJUSTMENT_LIMITS.contrast.step,
            onChange: () => this._emitChange(),
        });
        this.contrastScale = contrastSlider.scale;
        grid.attach(contrastSlider.box, 1, 0, 1, 1);

        // Row 2: Brightness & Hue Shift
        const brightnessSlider = this._createCompactSlider({
            label: 'Brightness',
            min: ADJUSTMENT_LIMITS.brightness.min,
            max: ADJUSTMENT_LIMITS.brightness.max,
            defaultValue: ADJUSTMENT_LIMITS.brightness.default,
            step: ADJUSTMENT_LIMITS.brightness.step,
            onChange: () => this._emitChange(),
        });
        this.brightnessScale = brightnessSlider.scale;
        grid.attach(brightnessSlider.box, 0, 1, 1, 1);

        const hueSlider = this._createCompactSlider({
            label: 'Hue Shift',
            min: ADJUSTMENT_LIMITS.hue.min,
            max: ADJUSTMENT_LIMITS.hue.max,
            defaultValue: ADJUSTMENT_LIMITS.hue.default,
            step: ADJUSTMENT_LIMITS.hue.step,
            onChange: () => this._emitChange(),
        });
        this.hueScale = hueSlider.scale;
        grid.attach(hueSlider.box, 1, 1, 1, 1);

        // Row 3: Temperature & Gamma
        const temperatureSlider = this._createCompactSlider({
            label: 'Temperature',
            min: ADJUSTMENT_LIMITS.temperature.min,
            max: ADJUSTMENT_LIMITS.temperature.max,
            defaultValue: ADJUSTMENT_LIMITS.temperature.default,
            step: ADJUSTMENT_LIMITS.temperature.step,
            onChange: () => this._emitChange(),
        });
        this.temperatureScale = temperatureSlider.scale;
        grid.attach(temperatureSlider.box, 0, 2, 1, 1);

        const gammaSlider = this._createCompactSlider({
            label: 'Gamma',
            min: ADJUSTMENT_LIMITS.gamma.min,
            max: ADJUSTMENT_LIMITS.gamma.max,
            defaultValue: ADJUSTMENT_LIMITS.gamma.default,
            step: ADJUSTMENT_LIMITS.gamma.step,
            onChange: () => this._emitChange(),
        });
        this.gammaScale = gammaSlider.scale;
        grid.attach(gammaSlider.box, 1, 2, 1, 1);

        this.widget.append(grid);

        // Reset button
        const resetButton = new Gtk.Button({
            label: 'Reset Adjustments',
            halign: Gtk.Align.CENTER,
            margin_top: 4,
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
        const {
            label,
            min,
            max,
            defaultValue,
            step,
            onChange
        } = config;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
        });

        const labelWidget = new Gtk.Label({
            label,
            xalign: 0,
            css_classes: ['caption'],
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

    _emitChange() {
        if (this.onAdjustmentChange) {
            this.onAdjustmentChange(this.getValues());
        }
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

    show() {
        this.widget.set_visible(true);
    }

    hide() {
        this.widget.set_visible(false);
    }
}
