/**
 * OmarchyThemeCard - Individual theme card component for the Omarchy themes browser
 *
 * Displays a theme with:
 * - Preview image or color gradient fallback
 * - 16-color swatch grid
 * - Theme name with optional badges (ACTIVE, GENERATED)
 * - Import and Apply action buttons
 *
 * @module OmarchyThemeCard
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget} from '../utils/ui-helpers.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {SPACING} from '../constants/ui-constants.js';

/**
 * OmarchyThemeCard - Card component for displaying an Omarchy theme
 * @class
 * @extends {Gtk.Box}
 */
export const OmarchyThemeCard = GObject.registerClass(
    {
        Signals: {
            'theme-import': {param_types: [GObject.TYPE_JSOBJECT]},
            'theme-apply': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class OmarchyThemeCard extends Gtk.Box {
        /**
         * Create a theme card
         * @param {Object} theme - Theme data object
         */
        _init(theme) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                width_request: 200,
            });

            this._theme = theme;

            // Sharp card styling
            applyCssToWidget(
                this,
                `
                box {
                    background-color: alpha(@view_bg_color, 0.5);
                    border: 1px solid alpha(@borders, 0.15);
                    border-radius: 0;
                }
            `
            );

            this._buildUI();
        }

        /**
         * Build the card UI
         * @private
         */
        _buildUI() {
            // Thumbnail/preview
            const thumbnail = this._createThumbnail();
            this.append(thumbnail);

            // Color grid
            const colorGrid = this._createColorGrid();
            this.append(colorGrid);

            // Name and badges row
            const nameRow = this._createNameRow();
            this.append(nameRow);

            // Action buttons
            const buttonBox = this._createButtons();
            this.append(buttonBox);
        }

        /**
         * Create the thumbnail/preview section
         * @private
         * @returns {Gtk.Widget} Thumbnail widget
         */
        _createThumbnail() {
            const theme = this._theme;

            // If we have a preview image, try to load it
            if (theme.previewImage && GLib.file_test(theme.previewImage, GLib.FileTest.EXISTS)) {
                try {
                    const file = Gio.File.new_for_path(theme.previewImage);
                    const thumbPath = thumbnailService.getThumbnailPath(theme.previewImage);
                    const thumbFile = Gio.File.new_for_path(thumbPath);

                    let pixbuf;
                    if (thumbnailService.isThumbnailValid(thumbFile, file)) {
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                            thumbPath,
                            200,
                            120,
                            true
                        );
                    } else {
                        // Generate thumbnail
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                            theme.previewImage,
                            300,
                            300,
                            true
                        );
                        pixbuf.savev(thumbPath, 'png', [], []);

                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                            thumbPath,
                            200,
                            120,
                            true
                        );
                    }

                    const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                    return new Gtk.Picture({
                        paintable: texture,
                        content_fit: Gtk.ContentFit.COVER,
                        width_request: 200,
                        height_request: 120,
                    });
                } catch (e) {
                    console.warn(`Failed to load preview for ${theme.name}:`, e.message);
                }
            }

            // Fallback: create a color gradient preview
            return this._createColorPreview();
        }

        /**
         * Create a color gradient preview (fallback when no image)
         * @private
         * @returns {Gtk.Box} Color preview widget
         */
        _createColorPreview() {
            const colors = this._theme.colors || [];

            const grid = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                width_request: 200,
                height_request: 120,
            });

            if (colors.length >= 4) {
                // Use a selection of colors for gradient effect
                [0, 5, 10, 15].forEach(i => {
                    const box = new Gtk.Box({hexpand: true});
                    applyCssToWidget(
                        box,
                        `
                        box {
                            background-color: ${colors[i] || colors[0]};
                            border-radius: 0;
                        }
                    `
                    );
                    grid.append(box);
                });
            }

            return grid;
        }

        /**
         * Create the 16-color grid
         * @private
         * @returns {Gtk.Box} Color grid container
         */
        _createColorGrid() {
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 1,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
            });

            const colors = this._theme.colors || [];
            if (colors.length === 0) return container;

            // Row 1: colors 0-7
            const row1 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 0; i < 8 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 22,
                    height_request: 16,
                });
                applyCssToWidget(
                    box,
                    `
                    box {
                        background-color: ${colors[i]};
                        border-radius: 0;
                    }
                `
                );
                row1.append(box);
            }

            // Row 2: colors 8-15
            const row2 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 8; i < 16 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 22,
                    height_request: 16,
                });
                applyCssToWidget(
                    box,
                    `
                    box {
                        background-color: ${colors[i]};
                        border-radius: 0;
                    }
                `
                );
                row2.append(box);
            }

            container.append(row1);
            container.append(row2);
            return container;
        }

        /**
         * Create name row with badges
         * @private
         * @returns {Gtk.Box} Name row widget
         */
        _createNameRow() {
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 4,
            });

            // Name and badges in horizontal box
            const nameBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            // Theme name
            const nameLabel = new Gtk.Label({
                label: this._theme.name,
                halign: Gtk.Align.START,
                css_classes: ['heading'],
                ellipsize: 3,
                max_width_chars: 16,
                hexpand: true,
            });
            nameBox.append(nameLabel);

            // Badges
            if (this._theme.isCurrentTheme) {
                const activeBadge = new Gtk.Label({
                    label: 'ACTIVE',
                    css_classes: ['caption'],
                    halign: Gtk.Align.END,
                });
                applyCssToWidget(
                    activeBadge,
                    `
                    label {
                        background-color: alpha(@accent_bg_color, 0.3);
                        color: @accent_fg_color;
                        padding: 2px 6px;
                        font-size: 9px;
                        font-weight: bold;
                    }
                `
                );
                nameBox.append(activeBadge);
            }

            if (this._theme.isAetherGenerated || this._theme.isSymlink) {
                const badge = new Gtk.Label({
                    label: this._theme.isAetherGenerated ? 'AETHER' : 'LINK',
                    css_classes: ['caption'],
                    halign: Gtk.Align.END,
                });
                applyCssToWidget(
                    badge,
                    `
                    label {
                        background-color: alpha(@view_fg_color, 0.1);
                        color: alpha(@view_fg_color, 0.7);
                        padding: 2px 6px;
                        font-size: 9px;
                    }
                `
                );
                nameBox.append(badge);
            }

            container.append(nameBox);

            // Description (if available)
            if (this._theme.description) {
                const descLabel = new Gtk.Label({
                    label: this._theme.description,
                    halign: Gtk.Align.START,
                    css_classes: ['dim-label', 'caption'],
                    ellipsize: 3,
                    max_width_chars: 26,
                });
                container.append(descLabel);
            }

            return container;
        }

        /**
         * Create action buttons
         * @private
         * @returns {Gtk.Box} Button box widget
         */
        _createButtons() {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 12,
            });

            // Import button
            const importButton = new Gtk.Button({
                label: 'Import',
                hexpand: true,
            });
            applyCssToWidget(
                importButton,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                }
            `
            );
            importButton.connect('clicked', () => {
                this.emit('theme-import', this._theme);
            });
            buttonBox.append(importButton);

            // Apply button
            const applyButton = new Gtk.Button({
                label: 'Apply',
                hexpand: true,
                css_classes: ['suggested-action'],
                sensitive: !this._theme.isCurrentTheme,
            });
            applyCssToWidget(
                applyButton,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                }
            `
            );
            applyButton.connect('clicked', () => {
                this.emit('theme-apply', this._theme);
            });

            // If current theme, show as less prominent
            if (this._theme.isCurrentTheme) {
                applyButton.set_label('Current');
            }

            buttonBox.append(applyButton);

            return buttonBox;
        }

        /**
         * Get the theme data
         * @returns {Object} Theme object
         */
        getTheme() {
            return this._theme;
        }
    }
);
