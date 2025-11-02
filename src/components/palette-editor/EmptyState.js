import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {uploadWallpaper} from '../../utils/wallpaper-utils.js';

/**
 * EmptyState - Initial state shown when no wallpaper is loaded
 * Provides upload button and drag-drop area
 */
export const EmptyState = GObject.registerClass(
    {
        Signals: {
            'wallpaper-uploaded': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class EmptyState extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 24,
                margin_bottom: 24,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
            });

            this._buildUI();
            this._setupDragDrop();
        }

        _buildUI() {
            // Icon
            const icon = new Gtk.Image({
                icon_name: 'image-x-generic-symbolic',
                pixel_size: 64,
                css_classes: ['dim-label'],
            });
            this.append(icon);

            // Title
            const title = new Gtk.Label({
                label: 'No Wallpaper Loaded',
                css_classes: ['title-2'],
                margin_top: 12,
            });
            this.append(title);

            // Subtitle
            const subtitle = new Gtk.Label({
                label: 'Upload an image or drag and drop to get started',
                css_classes: ['dim-label'],
                margin_bottom: 12,
            });
            this.append(subtitle);

            // Upload button
            const uploadBtn = new Gtk.Button({
                label: 'Select Image',
                css_classes: ['pill', 'suggested-action'],
            });
            uploadBtn.connect('clicked', () => this._uploadWallpaper());
            this.append(uploadBtn);
        }

        _setupDragDrop() {
            const dropTarget = Gtk.DropTarget.new(
                Gdk.FileList.$gtype,
                Gdk.DragAction.COPY
            );

            dropTarget.connect('drop', (target, value, x, y) => {
                const files = value.get_files();
                if (files && files.length > 0) {
                    const file = files[0];
                    const path = file.get_path();
                    if (path) {
                        this.emit('wallpaper-uploaded', path);
                        return true;
                    }
                }
                return false;
            });

            this.add_controller(dropTarget);
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
