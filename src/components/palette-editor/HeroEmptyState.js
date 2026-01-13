import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {uploadWallpaper} from '../../utils/wallpaper-utils.js';
import {applyCssToWidget} from '../../utils/ui-helpers.js';

/**
 * HeroEmptyState - Dramatic initial state when no wallpaper is loaded
 * Features a bold visual design with gradient accents and clear CTAs
 */
export const HeroEmptyState = GObject.registerClass(
    {
        Signals: {
            'wallpaper-uploaded': {param_types: [GObject.TYPE_STRING]},
            'browse-wallhaven-clicked': {},
            'browse-local-clicked': {},
        },
    },
    class HeroEmptyState extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                vexpand: true,
                hexpand: true,
            });

            this._buildUI();
        }

        _buildUI() {
            // Main container with centered content
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                vexpand: true,
                hexpand: true,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
            });

            // Hero section with visual impact
            const heroBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                halign: Gtk.Align.CENTER,
                margin_start: 48,
                margin_end: 48,
                margin_top: 32,
                margin_bottom: 32,
            });

            // Color bar accent - visual hook
            const colorBar = this._createColorBar();
            heroBox.append(colorBar);

            // Main headline
            const headline = new Gtk.Label({
                label: 'Create Your Theme',
                css_classes: ['title-1'],
                halign: Gtk.Align.CENTER,
            });
            applyCssToWidget(
                headline,
                `
                label {
                    font-size: 32px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                    color: @window_fg_color;
                }
            `
            );
            heroBox.append(headline);

            // Subheadline
            const subheadline = new Gtk.Label({
                label: 'Extract colors from any wallpaper',
                css_classes: ['dim-label'],
                halign: Gtk.Align.CENTER,
            });
            applyCssToWidget(
                subheadline,
                `
                label {
                    font-size: 16px;
                    font-weight: 400;
                    opacity: 0.7;
                }
            `
            );
            heroBox.append(subheadline);

            // Browse section
            const browseSection = this._createBrowseSection();
            heroBox.append(browseSection);

            // Alternative actions
            const actionsBox = this._createActionsBox();
            heroBox.append(actionsBox);

            // Quick steps (minimal)
            const stepsBox = this._createStepsIndicator();
            heroBox.append(stepsBox);

            container.append(heroBox);
            this.append(container);
        }

        _createColorBar() {
            const bar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                halign: Gtk.Align.CENTER,
                margin_bottom: 16,
            });

            // Sample palette colors - creates visual interest
            const colors = [
                '#1e1e2e',
                '#f38ba8',
                '#a6e3a1',
                '#f9e2af',
                '#89b4fa',
                '#cba6f7',
                '#94e2d5',
                '#cdd6f4',
            ];

            colors.forEach((color, index) => {
                const swatch = new Gtk.Box({
                    width_request: 40,
                    height_request: 6,
                });
                applyCssToWidget(
                    swatch,
                    `
                    box {
                        background-color: ${color};
                        border-radius: 0;
                    }
                `
                );
                bar.append(swatch);
            });

            return bar;
        }

        _createBrowseSection() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 16,
                halign: Gtk.Align.CENTER,
                margin_top: 32,
                margin_bottom: 8,
            });

            // Browse button
            const browseBtn = new Gtk.Button({
                css_classes: ['suggested-action'],
            });

            const btnContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
            });
            btnContent.append(
                new Gtk.Image({icon_name: 'folder-pictures-symbolic'})
            );
            btnContent.append(new Gtk.Label({label: 'Browse Files'}));
            browseBtn.set_child(btnContent);

            applyCssToWidget(
                browseBtn,
                `
                button {
                    padding: 12px 32px;
                    font-weight: 600;
                    border-radius: 0;
                }
            `
            );
            browseBtn.connect('clicked', () => this._uploadWallpaper());
            box.append(browseBtn);

            return box;
        }

        _createActionsBox() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 16,
                halign: Gtk.Align.CENTER,
                margin_top: 16,
            });

            // Separator label
            const separator = new Gtk.Label({
                label: 'Or browse from',
                css_classes: ['dim-label'],
            });
            applyCssToWidget(
                separator,
                `
                label {
                    font-size: 13px;
                    opacity: 0.6;
                }
            `
            );
            box.append(separator);

            // Wallhaven button
            const wallhavenBtn = new Gtk.Button({
                css_classes: ['flat'],
            });

            const wallhavenContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            wallhavenContent.append(
                new Gtk.Image({icon_name: 'web-browser-symbolic'})
            );
            wallhavenContent.append(new Gtk.Label({label: 'Wallhaven'}));
            wallhavenBtn.set_child(wallhavenContent);

            applyCssToWidget(
                wallhavenBtn,
                `
                button {
                    padding: 6px 12px;
                    border-radius: 0;
                    font-weight: 500;
                }
                button:hover {
                    background-color: alpha(@accent_bg_color, 0.1);
                }
            `
            );
            wallhavenBtn.connect('clicked', () => {
                this.emit('browse-wallhaven-clicked');
            });
            box.append(wallhavenBtn);

            // Local button
            const localBtn = new Gtk.Button({
                css_classes: ['flat'],
            });

            const localContent = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            localContent.append(
                new Gtk.Image({icon_name: 'folder-symbolic'})
            );
            localContent.append(new Gtk.Label({label: 'Local'}));
            localBtn.set_child(localContent);

            applyCssToWidget(
                localBtn,
                `
                button {
                    padding: 6px 12px;
                    border-radius: 0;
                    font-weight: 500;
                }
                button:hover {
                    background-color: alpha(@accent_bg_color, 0.1);
                }
            `
            );
            localBtn.connect('clicked', () => {
                this.emit('browse-local-clicked');
            });
            box.append(localBtn);

            return box;
        }

        _createStepsIndicator() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 32,
                halign: Gtk.Align.CENTER,
                margin_top: 40,
            });

            const steps = [
                {icon: 'image-x-generic-symbolic', label: 'Select'},
                {icon: 'color-select-symbolic', label: 'Extract'},
                {icon: 'emblem-ok-symbolic', label: 'Apply'},
            ];

            steps.forEach((step, index) => {
                const stepBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8,
                });

                // Step number
                const numberBox = new Gtk.Box({
                    width_request: 24,
                    height_request: 24,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                });
                const numberLabel = new Gtk.Label({
                    label: `${index + 1}`,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                });
                applyCssToWidget(
                    numberBox,
                    `
                    box {
                        background-color: alpha(@accent_bg_color, 0.15);
                        border-radius: 0;
                    }
                `
                );
                applyCssToWidget(
                    numberLabel,
                    `
                    label {
                        font-size: 11px;
                        font-weight: 700;
                        color: @accent_bg_color;
                    }
                `
                );
                numberBox.append(numberLabel);
                stepBox.append(numberBox);

                // Step label
                const label = new Gtk.Label({
                    label: step.label,
                    css_classes: ['dim-label'],
                });
                applyCssToWidget(
                    label,
                    `
                    label {
                        font-size: 12px;
                        font-weight: 500;
                        opacity: 0.7;
                    }
                `
                );
                stepBox.append(label);

                box.append(stepBox);

                // Arrow between steps
                if (index < steps.length - 1) {
                    const arrow = new Gtk.Label({
                        label: '→',
                        css_classes: ['dim-label'],
                    });
                    applyCssToWidget(
                        arrow,
                        `
                        label {
                            opacity: 0.3;
                            font-size: 14px;
                        }
                    `
                    );
                    box.append(arrow);
                }
            });

            return box;
        }

        _uploadWallpaper() {
            uploadWallpaper(this.get_root(), path => {
                if (path) {
                    this.emit('wallpaper-uploaded', path);
                }
            });
        }
    }
);
