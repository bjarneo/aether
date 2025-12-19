import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {uploadWallpaper} from '../../utils/wallpaper-utils.js';
import {SPACING} from '../../constants/ui-constants.js';

/**
 * EmptyState - Initial state shown when no wallpaper is loaded
 * Provides helpful guidance and quick start actions
 */
export const EmptyState = GObject.registerClass(
    {
        Signals: {
            'wallpaper-uploaded': {param_types: [GObject.TYPE_STRING]},
            'browse-wallhaven-clicked': {},
            'browse-local-clicked': {},
        },
    },
    class EmptyState extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 20,
                margin_top: 48,
                margin_bottom: 48,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                vexpand: true,
            });

            this._buildUI();
        }

        _buildUI() {
            // Large icon
            const icon = new Gtk.Image({
                icon_name: 'image-x-generic-symbolic',
                pixel_size: 96,
                css_classes: ['dim-label'],
            });
            this.append(icon);

            // Main title
            const title = new Gtk.Label({
                label: 'Get Started in 3 Easy Steps',
                css_classes: ['title-1'],
                margin_top: SPACING.MD,
            });
            this.append(title);

            // Step-by-step guide
            const stepsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                margin_top: 16,
                margin_bottom: 24,
            });

            const steps = [
                '1. Select a wallpaper (upload or browse online)',
                '2. Extract color palette with one click',
                '3. Customize colors and apply your theme',
            ];

            steps.forEach(step => {
                const stepLabel = new Gtk.Label({
                    label: step,
                    css_classes: ['caption'],
                    xalign: 0,
                });
                stepsBox.append(stepLabel);
            });

            this.append(stepsBox);

            // Quick start buttons
            const buttonsBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                halign: Gtk.Align.CENTER,
            });

            // Upload button (primary action)
            const uploadBtn = new Gtk.Button({
                label: 'Upload Image',
                css_classes: ['pill', 'suggested-action'],
            });
            uploadBtn.connect('clicked', () => this._uploadWallpaper());
            buttonsBox.append(uploadBtn);

            // Browse Wallhaven button
            const wallhavenBtn = new Gtk.Button({
                label: 'Browse Wallhaven',
                css_classes: ['pill'],
            });
            wallhavenBtn.connect('clicked', () => {
                this.emit('browse-wallhaven-clicked');
            });
            buttonsBox.append(wallhavenBtn);

            // Browse Local button
            const localBtn = new Gtk.Button({
                label: 'Browse Local',
                css_classes: ['pill'],
            });
            localBtn.connect('clicked', () => {
                this.emit('browse-local-clicked');
            });
            buttonsBox.append(localBtn);

            this.append(buttonsBox);
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
