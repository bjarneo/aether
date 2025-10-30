import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import {uploadMultipleWallpapers} from '../../utils/wallpaper-utils.js';

/**
 * AdditionalImagesSection - Manages additional background images
 * Allows users to add multiple images beyond the main wallpaper
 */
export const AdditionalImagesSection = GObject.registerClass(
    {
        Signals: {
            'images-changed': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class AdditionalImagesSection extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 12,
                visible: true,
            });

            this._images = [];
            this._buildUI();
        }

        _buildUI() {
            // Header with label and add button
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const label = new Gtk.Label({
                label: 'Additional Images',
                xalign: 0,
                hexpand: true,
                css_classes: ['caption'],
            });
            headerBox.append(label);

            // Add image button
            const addButton = new Gtk.Button({
                icon_name: 'list-add-symbolic',
                tooltip_text: 'Add additional background images',
                css_classes: ['flat'],
            });
            addButton.connect('clicked', () => this._addImages());
            headerBox.append(addButton);

            this.append(headerBox);

            // Grid for additional images (hidden when empty)
            this._imagesGrid = new Gtk.FlowBox({
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 6,
                row_spacing: 6,
                homogeneous: true,
                max_children_per_line: 4,
                min_children_per_line: 2,
                visible: false,
            });
            this.append(this._imagesGrid);
        }

        _addImages() {
            uploadMultipleWallpapers(this.get_root(), paths => {
                if (paths && paths.length > 0) {
                    this._images.push(...paths);
                    this._updateDisplay();
                    this.emit('images-changed', this._images);
                }
            });
        }

        _updateDisplay() {
            // Clear existing items
            let child = this._imagesGrid.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._imagesGrid.remove(child);
                child = next;
            }

            // Show/hide grid based on images
            this._imagesGrid.set_visible(this._images.length > 0);

            // Add image cards
            this._images.forEach((imagePath, index) => {
                const card = this._createImageCard(imagePath, index);
                this._imagesGrid.append(card);
            });
        }

        _createImageCard(imagePath, index) {
            const overlay = new Gtk.Overlay();

            // Image preview
            const picture = new Gtk.Picture({
                width_request: 120,
                height_request: 80,
                can_shrink: true,
                content_fit: Gtk.ContentFit.COVER,
                css_classes: ['card'],
            });

            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(imagePath);
                const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                picture.set_paintable(texture);
            } catch (e) {
                console.error('Failed to load additional image:', e);
            }

            overlay.set_child(picture);

            // Remove button
            const removeBtn = new Gtk.Button({
                icon_name: 'window-close-symbolic',
                css_classes: ['circular', 'destructive-action'],
                halign: Gtk.Align.END,
                valign: Gtk.Align.START,
                margin_top: 6,
                margin_end: 6,
            });
            removeBtn.connect('clicked', () => {
                this._images.splice(index, 1);
                this._updateDisplay();
                this.emit('images-changed', this._images);
            });
            overlay.add_overlay(removeBtn);

            return overlay;
        }

        getImages() {
            return [...this._images];
        }

        setImages(images) {
            this._images = images ? [...images] : [];
            this._updateDisplay();
        }

        reset() {
            this._images = [];
            this._updateDisplay();
        }
    }
);
