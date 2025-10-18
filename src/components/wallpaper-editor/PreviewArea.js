import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=4.0';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {buildCssFilterString} from '../../utils/image-filter-utils.js';

/**
 * PreviewArea - Displays wallpaper preview with CSS filters applied in real-time
 *
 * Features:
 * - Click and hold to temporarily show original image without filters
 * - Real-time CSS filter updates
 */
export const PreviewArea = GObject.registerClass(
    class PreviewArea extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 18,
                hexpand: true,
                vexpand: true,
                margin_start: 6,
                margin_end: 18,
            });

            this._wallpaperPath = null;
            this._currentFilters = null;
            this._filtersTemporarilyDisabled = false;

            this._buildUI();
        }

        _buildUI() {
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_bottom: 0,
            });

            const label = new Gtk.Label({
                label: 'Preview',
                css_classes: ['title-3'],
                xalign: 0,
                hexpand: true,
            });

            headerBox.append(label);

            // Hint label for click-and-hold feature
            const hintLabel = new Gtk.Label({
                label: 'Hold click to view original',
                css_classes: ['dim-label', 'caption'],
                xalign: 1,
            });
            headerBox.append(hintLabel);

            this.append(headerBox);

            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                hexpand: true,
                vexpand: true,
                margin_top: 0,
            });

            this._previewPicture = new Gtk.Picture({
                can_shrink: true,
                content_fit: Gtk.ContentFit.CONTAIN,
            });

            scrolled.set_child(this._previewPicture);

            const frame = new Gtk.Frame({
                css_classes: ['card'],
                child: scrolled,
            });

            // Add click gesture for hold-to-show-original
            const gestureClick = new Gtk.GestureClick();

            gestureClick.connect('pressed', () => {
                this._filtersTemporarilyDisabled = true;
                this._applyCurrentFilters();
            });

            gestureClick.connect('released', () => {
                this._filtersTemporarilyDisabled = false;
                this._applyCurrentFilters();
            });

            gestureClick.connect('cancel', () => {
                this._filtersTemporarilyDisabled = false;
                this._applyCurrentFilters();
            });

            frame.add_controller(gestureClick);

            this.append(frame);
        }

        setWallpaper(wallpaperPath) {
            this._wallpaperPath = wallpaperPath;
            try {
                const file = Gio.File.new_for_path(wallpaperPath);
                this._previewPicture.set_file(file);
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        updateFilters(filters) {
            this._currentFilters = filters;
            this._applyCurrentFilters();
        }

        clearFilters() {
            this._currentFilters = null;
            this._applyCurrentFilters();
        }

        _applyCurrentFilters() {
            if (this._filtersTemporarilyDisabled || !this._currentFilters) {
                applyCssToWidget(this._previewPicture, '* { filter: none; }');
            } else {
                const filterString = buildCssFilterString(this._currentFilters);
                const css = `* { filter: ${filterString}; }`;
                applyCssToWidget(this._previewPicture, css);
            }
        }
    }
);
