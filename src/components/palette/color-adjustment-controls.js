import Gtk from 'gi://Gtk?version=4.0';

import { createLabeledSlider } from '../../utils/ui-helpers.js';
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
            spacing: 2,
            margin_top: 4,
            margin_bottom: 4,
            visible: false,
        });

        this._createControls();
    }

    _createControls() {
        // Vibrance slider
        const vibranceSlider = createLabeledSlider({
            label: 'Vibrance',
            min: ADJUSTMENT_LIMITS.vibrance.min,
            max: ADJUSTMENT_LIMITS.vibrance.max,
            defaultValue: ADJUSTMENT_LIMITS.vibrance.default,
            step: ADJUSTMENT_LIMITS.vibrance.step,
            onChange: () => this._emitChange(),
        });
        this.vibranceScale = vibranceSlider.scale;
        this.widget.append(vibranceSlider.box);

        // Contrast slider
        const contrastSlider = createLabeledSlider({
            label: 'Contrast',
            min: ADJUSTMENT_LIMITS.contrast.min,
            max: ADJUSTMENT_LIMITS.contrast.max,
            defaultValue: ADJUSTMENT_LIMITS.contrast.default,
            step: ADJUSTMENT_LIMITS.contrast.step,
            onChange: () => this._emitChange(),
        });
        this.contrastScale = contrastSlider.scale;
        this.widget.append(contrastSlider.box);

        // Brightness slider
        const brightnessSlider = createLabeledSlider({
            label: 'Brightness',
            min: ADJUSTMENT_LIMITS.brightness.min,
            max: ADJUSTMENT_LIMITS.brightness.max,
            defaultValue: ADJUSTMENT_LIMITS.brightness.default,
            step: ADJUSTMENT_LIMITS.brightness.step,
            onChange: () => this._emitChange(),
        });
        this.brightnessScale = brightnessSlider.scale;
        this.widget.append(brightnessSlider.box);

        // Hue shift slider
        const hueSlider = createLabeledSlider({
            label: 'Hue Shift',
            min: ADJUSTMENT_LIMITS.hue.min,
            max: ADJUSTMENT_LIMITS.hue.max,
            defaultValue: ADJUSTMENT_LIMITS.hue.default,
            step: ADJUSTMENT_LIMITS.hue.step,
            onChange: () => this._emitChange(),
        });
        this.hueScale = hueSlider.scale;
        this.widget.append(hueSlider.box);

        // Reset button
        const resetButton = new Gtk.Button({
            label: 'Reset',
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
        };
    }

    reset() {
        this.vibranceScale.set_value(ADJUSTMENT_LIMITS.vibrance.default);
        this.contrastScale.set_value(ADJUSTMENT_LIMITS.contrast.default);
        this.brightnessScale.set_value(ADJUSTMENT_LIMITS.brightness.default);
        this.hueScale.set_value(ADJUSTMENT_LIMITS.hue.default);
    }

    show() {
        this.widget.set_visible(true);
    }

    hide() {
        this.widget.set_visible(false);
    }
}
