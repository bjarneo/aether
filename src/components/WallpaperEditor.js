import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {FilterControls} from './wallpaper-editor/FilterControls.js';
import {PreviewArea} from './wallpaper-editor/PreviewArea.js';
import {
    DEFAULT_FILTERS,
    hasActiveFilters,
    applyFiltersWithImageMagick,
    getProcessedWallpaperCachePath,
} from '../utils/image-filter-utils.js';

/**
 * WallpaperEditor - Apply filters to wallpapers before color extraction
 * 
 * Features:
 * - Real-time CSS filter preview
 * - ImageMagick-based filter application for final output
 * - Multiple filter types: blur, brightness, contrast, saturation, etc.
 * - Quick presets and color tone effects
 */
export const WallpaperEditor = GObject.registerClass(
    {
        Signals: {
            'wallpaper-applied': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperEditor extends Gtk.Box {
        _init(wallpaperPath) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._wallpaperPath = wallpaperPath;
            this._filters = {...DEFAULT_FILTERS};

            this._buildUI();
            this._connectSignals();
            this._loadWallpaper();
        }

        _buildUI() {
            // Header
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 18,
                margin_bottom: 12,
                margin_start: 18,
                margin_end: 18,
            });

            const titleLabel = new Gtk.Label({
                label: 'Wallpaper Editor',
                css_classes: ['title-3'],
                xalign: 0,
                hexpand: true,
            });
            headerBox.append(titleLabel);

            // Reset button on the left side of Apply
            const resetButton = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                tooltip_text: 'Reset all filters to default',
                valign: Gtk.Align.CENTER,
            });
            resetButton.connect('clicked', () => this._onResetClicked());
            headerBox.append(resetButton);

            // Action buttons box (Apply and Cancel)
            const actionBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            this._applySpinner = new Gtk.Spinner({
                width_request: 16,
                height_request: 16,
                visible: false,
            });

            this._applyButton = new Gtk.Button({
                label: 'Apply',
                tooltip_text: 'Apply filters and return to palette editor',
                css_classes: ['suggested-action'],
            });
            this._applyButton.connect('clicked', () => this._onApplyClicked());

            const cancelButton = new Gtk.Button({
                label: 'Cancel',
                tooltip_text: 'Cancel and return without applying filters',
            });
            cancelButton.connect('clicked', () => this._onCancelClicked());

            actionBox.append(this._applySpinner);
            actionBox.append(this._applyButton);
            actionBox.append(cancelButton);
            headerBox.append(actionBox);

            this.append(headerBox);

            // Main content - side by side preview and controls
            const paned = new Gtk.Paned({
                orientation: Gtk.Orientation.HORIZONTAL,
                shrink_start_child: false,
                shrink_end_child: false,
                resize_start_child: true,
                resize_end_child: false,
                hexpand: true,
                vexpand: true,
                position: 650,
                margin_top: 0,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 6,
            });

            // Left: Preview
            this._previewArea = new PreviewArea();
            paned.set_start_child(this._previewArea);

            // Right: Controls
            this._filterControls = new FilterControls();
            const controlsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                width_request: 360,
            });
            controlsBox.append(this._filterControls);
            paned.set_end_child(controlsBox);

            const mainBox = new Gtk.Box({
                margin_top: 0,
                margin_bottom: 0,
                margin_start: 0,
                margin_end: 0,
                hexpand: true,
                vexpand: true,
            });
            mainBox.append(paned);

            this.append(mainBox);
        }

        _connectSignals() {
            // Update preview when filters change
            this._filterControls.connect('filter-changed', (_, filters) => {
                this._filters = filters;
                this._previewArea.updateFilters(filters);
            });

            this._filterControls.connect('preset-applied', (_, filters) => {
                this._filters = filters;
                this._previewArea.updateFilters(filters);
            });

            this._filterControls.connect('reset-filters', () => {
                this._filters = {...DEFAULT_FILTERS};
                this._previewArea.clearFilters();
            });
        }

        _loadWallpaper() {
            this._previewArea.setWallpaper(this._wallpaperPath);
        }

        _onResetClicked() {
            // Trigger reset on FilterControls
            this._filterControls._resetFilters();
        }

        _onCancelClicked() {
            // Return to main view without applying filters
            // Emit wallpaper-applied with the original wallpaper path
            this.emit('wallpaper-applied', this._wallpaperPath);
        }

        async _onApplyClicked() {
            // Show spinner, hide button
            this._applyButton.set_visible(false);
            this._applySpinner.set_visible(true);
            this._applySpinner.start();

            try {
                // Check if any filters are active
                if (!hasActiveFilters(this._filters)) {
                    // No filters applied, return original
                    this.emit('wallpaper-applied', this._wallpaperPath);
                    return;
                }

                const processedPath = await this._processWallpaper();
                this.emit('wallpaper-applied', processedPath);
            } catch (e) {
                console.error('Failed to apply wallpaper:', e.message);
            } finally {
                // Reset button state
                this._applySpinner.stop();
                this._applySpinner.set_visible(false);
                this._applyButton.set_visible(true);
            }
        }

        async _processWallpaper() {
            console.log('Applying filters:', JSON.stringify(this._filters));

            const outputPath = getProcessedWallpaperCachePath();
            return await applyFiltersWithImageMagick(
                this._wallpaperPath,
                outputPath,
                this._filters
            );
        }
    }
);
