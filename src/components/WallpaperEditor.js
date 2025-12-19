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
import {SPACING} from '../constants/ui-constants.js';

/**
 * WallpaperEditor - Professional wallpaper filter editor component
 *
 * Full-screen editor interface for applying professional image filters to
 * wallpapers before color extraction. Provides real-time preview with optimized
 * ImageMagick processing and comprehensive filter controls.
 *
 * Architecture:
 * - PreviewArea (left panel): Large wallpaper preview with debounced ImageMagick rendering
 *   - Click-and-hold gesture to temporarily view original wallpaper
 *   - Preview base created on load (max 800px width for performance)
 *   - Debounced preview updates (75ms delay after adjustments)
 *   - JPEG preview format (quality 95) for faster I/O
 * - FilterControls (right sidebar): Scrollable filter controls organized in groups
 *   - Basic Adjustments (Blur, Brightness, Contrast, Saturation, Hue Shift)
 *   - Effects (Sepia, Invert)
 *   - Advanced (Exposure, Sharpen, Vignette, Grain, Shadows, Highlights)
 *   - Color Tone (8 presets + custom picker with intensity)
 *   - 12 Quick Presets (auto-reset filters before applying)
 *
 * Features:
 * - Debounced ImageMagick preview system (75ms after user stops adjusting)
 * - Scaled preview base (max 800px) for 3-5x faster processing
 * - 12 quick presets in 3 rows of 4:
 *   Row 1: Muted, Dramatic, Soft, Vintage
 *   Row 2: Vibrant, Faded, Cool, Warm
 *   Row 3: Cinematic, Film, Crisp, Portrait
 * - Basic filters:
 *   - Blur (0-5px, step 0.1)
 *   - Brightness (50-150%)
 *   - Contrast (50-150%)
 *   - Saturation (0-150%)
 *   - Hue Shift (0-360°)
 * - Effects:
 *   - Sepia (0-100%)
 *   - Invert (0-100%)
 * - Advanced (professional):
 *   - Exposure (-100 to 100) - Camera exposure simulation
 *   - Sharpen (0-100) - Edge enhancement
 *   - Vignette (0-100%) - Darken edges for focus
 *   - Grain (0-10, step 0.1) - Monochrome film grain overlay
 *   - Shadows (-100 to 100) - Lift or crush shadow detail
 *   - Highlights (-100 to 100) - Recover or blow out highlights
 * - Color tone system:
 *   - 8 preset tone colors (Blue, Cyan, Green, Yellow, Orange, Red, Pink, Purple)
 *   - Custom color picker with HSL preservation
 *   - Tone intensity slider (0-100%)
 * - Click & hold preview to view original wallpaper
 * - Reset button to clear all filters
 * - Cancel/Apply actions in header
 *
 * Performance Optimizations:
 * - Preview base created once on load (800px max width)
 * - Debounced ImageMagick preview (75ms) prevents rapid command spawning
 * - JPEG format for preview (quality 95) reduces I/O time
 * - Full-resolution processing only happens on "Apply"
 *
 * Output Format:
 * - JPEG format (quality 95) for both preview and final output
 * - Unique timestamped filename: `processed-wallpaper-{timestamp}.jpg`
 * - Saved to ~/.cache/aether/ directory
 * - Bypasses color extraction cache (forces fresh extraction)
 *
 * Sub-Components:
 * - FilterControls (src/components/wallpaper-editor/FilterControls.js)
 *   - All filter UI controls, presets, tone picker
 *   - Emits 'filter-changed', 'preset-applied', 'reset-filters' signals
 * - PreviewArea (src/components/wallpaper-editor/PreviewArea.js)
 *   - Debounced ImageMagick preview rendering
 *   - Click-and-hold original view gesture
 *   - Loading state management
 *
 * Signals:
 * - 'wallpaper-applied': (wallpaperPath: string) - Emitted when editor is closed
 *   - wallpaperPath is the processed image path if filters applied
 *   - wallpaperPath is the original path if cancelled or no filters active
 *
 * Integration:
 * - Opened via PaletteGenerator "Edit Wallpaper" button
 * - Replaces main content in AetherWindow while active
 * - Processed wallpaper is auto-loaded into PaletteGenerator on apply
 * - Original wallpaper restored on cancel
 *
 * @example
 * const editor = new WallpaperEditor('/path/to/wallpaper.jpg');
 * editor.connect('wallpaper-applied', (widget, processedPath) => {
 *     console.log(`Processed wallpaper: ${processedPath}`);
 *     loadWallpaperForExtraction(processedPath);
 * });
 * // User adjusts filters and clicks Apply or Cancel
 * // Signal is emitted with either processed path or original path
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
                spacing: SPACING.MD,
                margin_top: 18,
                margin_bottom: SPACING.MD,
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
                spacing: SPACING.SM,
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
                position: 900,
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
                width_request: 320,
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

        resetEditor(wallpaperPath) {
            // Reset to new wallpaper and clear all filters
            this._wallpaperPath = wallpaperPath;
            this._filters = {...DEFAULT_FILTERS};

            // Reset filter controls to default
            this._filterControls.setFilters(DEFAULT_FILTERS);

            // Load new wallpaper
            this._loadWallpaper();

            // Clear preview filters
            this._previewArea.clearFilters();
        }

        _onResetClicked() {
            // Reset all filters to defaults
            this._filterControls.resetFilters();
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
            const outputPath = getProcessedWallpaperCachePath();
            return await applyFiltersWithImageMagick(
                this._wallpaperPath,
                outputPath,
                this._filters
            );
        }
    }
);
