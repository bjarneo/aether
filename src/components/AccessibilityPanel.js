import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {
    getReadabilityScore,
    simulateColorBlindness
} from '../utils/accessibility-utils.js';
import { applyCssToWidget } from '../utils/ui-helpers.js';

export const AccessibilityPanel = GObject.registerClass(
    class AccessibilityPanel extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._colors = null;
            this._initializeUI();
        }

        _initializeUI() {
            const expanderRow = new Adw.ExpanderRow({
                title: 'Accessibility and Analysis',
                subtitle: 'Check contrast and color blindness compatibility',
            });

            // Contrast checker section
            this._contrastGroup = this._createContrastChecker();
            expanderRow.add_row(this._contrastGroup);

            // Color blindness preview section
            this._colorBlindnessGroup = this._createColorBlindnessPreview();
            expanderRow.add_row(this._colorBlindnessGroup);

            this.append(expanderRow);
        }

        _createContrastChecker() {
            const group = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 8,
            });

            const label = new Gtk.Label({
                label: 'Foreground/Background Contrast',
                halign: Gtk.Align.START,
                css_classes: ['heading'],
            });
            group.append(label);

            this._contrastLabel = new Gtk.Label({
                label: 'No colors selected',
                halign: Gtk.Align.START,
                wrap: true,
            });
            group.append(this._contrastLabel);

            this._complianceLabel = new Gtk.Label({
                label: '',
                halign: Gtk.Align.START,
                wrap: true,
                css_classes: ['dim-label'],
            });
            group.append(this._complianceLabel);

            // Visual preview
            this._contrastPreview = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                margin_top: 8,
            });

            this._previewNormalBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                css_classes: ['card'],
                margin_top: 4,
            });
            this._previewNormalLabel = new Gtk.Label({
                label: 'Normal text sample',
                halign: Gtk.Align.CENTER,
                hexpand: true,
                margin_top: 8,
                margin_bottom: 8,
            });
            this._previewNormalBox.append(this._previewNormalLabel);

            this._previewLargeBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                css_classes: ['card'],
                margin_top: 4,
            });
            this._previewLargeLabel = new Gtk.Label({
                label: 'Large text sample',
                halign: Gtk.Align.CENTER,
                hexpand: true,
                margin_top: 12,
                margin_bottom: 12,
            });
            this._previewLargeLabel.add_css_class('title-3');
            this._previewLargeBox.append(this._previewLargeLabel);

            this._contrastPreview.append(this._previewNormalBox);
            this._contrastPreview.append(this._previewLargeBox);
            group.append(this._contrastPreview);

            return group;
        }

        _createColorBlindnessPreview() {
            const group = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 12,
            });

            const label = new Gtk.Label({
                label: 'Color Blindness Simulation',
                halign: Gtk.Align.START,
                css_classes: ['heading'],
            });
            group.append(label);

            const typesBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
            });

            this._blindnessTypes = [
                { type: 'protanopia', name: 'Protanopia (Red-Blind)', preview: null },
                { type: 'deuteranopia', name: 'Deuteranopia (Green-Blind)', preview: null },
                { type: 'tritanopia', name: 'Tritanopia (Blue-Blind)', preview: null },
            ];

            this._blindnessTypes.forEach(item => {
                const row = this._createBlindnessRow(item);
                typesBox.append(row);
            });

            group.append(typesBox);
            return group;
        }

        _createBlindnessRow(item) {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
            });

            const nameLabel = new Gtk.Label({
                label: item.name,
                halign: Gtk.Align.START,
                css_classes: ['dim-label'],
            });
            box.append(nameLabel);

            const colorRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 2,
                height_request: 24,
            });

            item.preview = colorRow;
            box.append(colorRow);

            return box;
        }

        updateColors(colors) {
            this._colors = colors;

            if (!colors.background || !colors.foreground) {
                this._contrastLabel.set_label('No colors selected');
                this._complianceLabel.set_label('');
                return;
            }

            // Update contrast checker
            const readability = getReadabilityScore(colors.foreground, colors.background);

            this._contrastLabel.set_label(
                `Contrast Ratio: ${readability.ratio}:1 (${readability.recommendation})`
            );

            const normalCompliance = readability.normalText.level;
            const largeCompliance = readability.largeText.level;

            this._complianceLabel.set_label(
                `Normal Text: WCAG ${normalCompliance} • Large Text: WCAG ${largeCompliance}`
            );

            // Update preview boxes
            this._updatePreviewBox(
                this._previewNormalBox,
                this._previewNormalLabel,
                colors.foreground,
                colors.background,
                readability.normalText.level
            );
            this._updatePreviewBox(
                this._previewLargeBox,
                this._previewLargeLabel,
                colors.foreground,
                colors.background,
                readability.largeText.level
            );

            // Update color blindness preview
            this._updateColorBlindnessPreview(colors);
        }

        _updatePreviewBox(box, label, fg, bg, level) {
            const css = `* {
                background-color: ${bg};
                color: ${fg};
            }`;
            applyCssToWidget(box, css);

            // Add indicator
            const icon = level === 'AAA' ? '✓✓' : level === 'AA' ? '✓' : '✗';
            const currentText = label.get_label().replace(/^[✓✗]+ /, '');
            label.set_label(`${icon} ${currentText}`);
        }

        _updateColorBlindnessPreview(colors) {
            // Get first 6 colors for preview
            const previewColors = [];
            for (let i = 0; i < 6; i++) {
                const colorKey = `color${i}`;
                if (colors[colorKey]) {
                    previewColors.push(colors[colorKey]);
                }
            }

            this._blindnessTypes.forEach(item => {
                // Clear existing
                let child = item.preview.get_first_child();
                while (child) {
                    const next = child.get_next_sibling();
                    item.preview.remove(child);
                    child = next;
                }

                // Add simulated colors
                previewColors.forEach(color => {
                    const simulated = simulateColorBlindness(color, item.type);
                    const colorBox = new Gtk.Box({ hexpand: true });
                    const css = `* { background-color: ${simulated}; }`;
                    applyCssToWidget(colorBox, css);
                    item.preview.append(colorBox);
                });
            });
        }

        get widget() {
            return this;
        }
    }
);
