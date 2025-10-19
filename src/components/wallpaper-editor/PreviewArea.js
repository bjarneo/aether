import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

import {applyCssToWidget} from '../../utils/ui-helpers.js';
import {applyFiltersWithImageMagick} from '../../utils/image-filter-utils.js';

/**
 * PreviewArea - Displays wallpaper preview with ImageMagick filters
 *
 * Features:
 * - Click and hold to temporarily show original image without filters
 * - Debounced ImageMagick preview (75ms after user stops adjusting)
 * - Uses scaled-down preview base image (max 800px) for faster processing
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

            // Preview system
            this._previewBasePath = null; // Scaled-down version for fast IM processing
            this._previewFinalPath = null; // IM-processed preview
            this._debounceTimer = null; // Timer for debounced IM preview
            this._isProcessingPreview = false;

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
                // Show original full-size image
                const file = Gio.File.new_for_path(this._wallpaperPath);
                this._previewPicture.set_file(file);
                applyCssToWidget(this._previewPicture, '* { filter: none; }');
            });

            gestureClick.connect('released', () => {
                this._filtersTemporarilyDisabled = false;
                this._restoreFilteredPreview();
            });

            gestureClick.connect('cancel', () => {
                this._filtersTemporarilyDisabled = false;
                this._restoreFilteredPreview();
            });

            frame.add_controller(gestureClick);

            this.append(frame);
        }

        setWallpaper(wallpaperPath) {
            this._wallpaperPath = wallpaperPath;
            try {
                // Create scaled-down preview base image for fast IM processing
                // This also loads the preview base into the picture widget
                this._createPreviewBase();
            } catch (e) {
                console.error('Failed to load wallpaper:', e.message);
            }
        }

        /**
         * Create a scaled-down preview base image (max 800px width)
         * This smaller image is used for fast ImageMagick preview generation
         */
        _createPreviewBase() {
            try {
                const cacheDir = GLib.build_filenamev([
                    GLib.get_user_cache_dir(),
                    'aether',
                ]);
                GLib.mkdir_with_parents(cacheDir, 0o755);

                this._previewBasePath = GLib.build_filenamev([
                    cacheDir,
                    'preview_base.jpg',
                ]);
                this._previewFinalPath = GLib.build_filenamev([
                    cacheDir,
                    'preview_final.jpg',
                ]);

                // Load original image and scale it down
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(
                    this._wallpaperPath
                );
                const originalWidth = pixbuf.get_width();
                const originalHeight = pixbuf.get_height();

                // Scale to max 800px width while maintaining aspect ratio
                const maxWidth = 800;
                let newWidth = originalWidth;
                let newHeight = originalHeight;

                if (originalWidth > maxWidth) {
                    newWidth = maxWidth;
                    newHeight = Math.round(
                        (originalHeight * maxWidth) / originalWidth
                    );
                }

                const scaledPixbuf = pixbuf.scale_simple(
                    newWidth,
                    newHeight,
                    GdkPixbuf.InterpType.BILINEAR
                );

                // Save scaled preview base as JPEG for faster processing and smaller size
                scaledPixbuf.savev(
                    this._previewBasePath,
                    'jpeg',
                    ['quality'],
                    ['95']
                );

                // Load the preview base into the picture widget
                const file = Gio.File.new_for_path(this._previewBasePath);
                this._previewPicture.set_file(file);
            } catch (e) {
                console.error('Failed to create preview base:', e.message);
                // Fall back to loading original if preview creation fails
                const file = Gio.File.new_for_path(this._wallpaperPath);
                this._previewPicture.set_file(file);
            }
        }

        updateFilters(filters) {
            this._currentFilters = filters;

            // Schedule debounced ImageMagick preview (no CSS filters, ImageMagick only)
            this._scheduleImageMagickPreview();
        }

        clearFilters() {
            this._currentFilters = null;

            // Clear any pending preview generation
            if (this._debounceTimer) {
                GLib.source_remove(this._debounceTimer);
                this._debounceTimer = null;
            }

            // Reload the original preview base image (no filters)
            if (this._previewBasePath) {
                const file = Gio.File.new_for_path(this._previewBasePath);
                this._previewPicture.set_file(file);
            }

            // Clear any CSS filters
            applyCssToWidget(this._previewPicture, '* { filter: none; }');
        }

        /**
         * Restore filtered preview after user releases hold-to-show-original
         * Uses the IM-processed preview if available, otherwise shows the preview base
         */
        _restoreFilteredPreview() {
            // Check if we have an IM-processed preview available
            if (this._previewFinalPath) {
                const file = Gio.File.new_for_path(this._previewFinalPath);
                if (file.query_exists(null)) {
                    // Use the ImageMagick-processed preview
                    this._previewPicture.set_file(file);
                    applyCssToWidget(
                        this._previewPicture,
                        '* { filter: none; }'
                    );
                    return;
                }
            }

            // Fall back to unfiltered preview base if IM preview not ready yet
            if (this._previewBasePath) {
                const file = Gio.File.new_for_path(this._previewBasePath);
                this._previewPicture.set_file(file);
                applyCssToWidget(this._previewPicture, '* { filter: none; }');
            }
        }

        /**
         * Schedule a debounced ImageMagick preview generation
         * Waits 75ms after the last filter change before processing
         */
        _scheduleImageMagickPreview() {
            // Clear any existing timer
            if (this._debounceTimer) {
                GLib.source_remove(this._debounceTimer);
                this._debounceTimer = null;
            }

            // Don't schedule if we don't have a preview base yet
            if (!this._previewBasePath) {
                return;
            }

            // Set a new timer to run the ImageMagick preview after 75ms
            this._debounceTimer = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                75,
                () => {
                    this._runImageMagickPreview();
                    this._debounceTimer = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }

        /**
         * Run ImageMagick on the preview base image to generate high-fidelity preview
         */
        async _runImageMagickPreview() {
            if (this._isProcessingPreview || !this._previewBasePath) {
                return;
            }

            this._isProcessingPreview = true;

            try {
                // Apply filters to the small preview base image
                await applyFiltersWithImageMagick(
                    this._previewBasePath,
                    this._previewFinalPath,
                    this._currentFilters
                );

                // Load the processed preview (this will snap from CSS to IM preview)
                const file = Gio.File.new_for_path(this._previewFinalPath);
                this._previewPicture.set_file(file);

                // Clear CSS filters since we now have the ImageMagick-processed version
                applyCssToWidget(this._previewPicture, '* { filter: none; }');
            } catch (e) {
                console.error('Failed to generate IM preview:', e.message);
            } finally {
                this._isProcessingPreview = false;
            }
        }
    }
);
