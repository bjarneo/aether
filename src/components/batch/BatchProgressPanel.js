/**
 * BatchProgressPanel - Shows processing progress for batch wallpaper operations
 *
 * Displays:
 * - Overall progress bar with percentage
 * - Per-item status list (spinner/check/error icon with wallpaper name)
 * - Cancel button
 *
 * @module BatchProgressPanel
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {applyCssToWidget, removeAllChildren} from '../../utils/ui-helpers.js';
import {SPACING} from '../../constants/ui-constants.js';

const STATUS_ICONS = {
    pending: 'content-loading-symbolic',
    completed: 'emblem-ok-symbolic',
    failed: 'dialog-error-symbolic',
};

/**
 * BatchProgressPanel - Processing progress UI
 * @class
 * @extends {Gtk.Box}
 */
export const BatchProgressPanel = GObject.registerClass(
    {
        Signals: {
            'cancel-requested': {},
        },
    },
    class BatchProgressPanel extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.LG,
                margin_top: SPACING.XL,
                margin_bottom: SPACING.XL,
                margin_start: SPACING.XL,
                margin_end: SPACING.XL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
            });

            /** @private @type {Array<Object>} Item status tracking */
            this._items = [];

            /** @private @type {Map<number, Gtk.Widget>} Item row widgets */
            this._itemRows = new Map();

            this._initializeUI();
        }

        _initializeUI() {
            // Header
            const header = new Gtk.Label({
                label: 'Processing Wallpapers',
                css_classes: ['title-2'],
            });
            this.append(header);

            // Progress container
            const progressContainer = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
                width_request: 400,
            });

            // Progress bar
            this._progressBar = new Gtk.ProgressBar({
                show_text: true,
                hexpand: true,
            });
            applyCssToWidget(
                this._progressBar,
                `
                progressbar {
                    min-height: 20px;
                }
                progressbar trough {
                    border-radius: 0;
                }
                progressbar progress {
                    border-radius: 0;
                }
            `
            );
            progressContainer.append(this._progressBar);

            // Progress label
            this._progressLabel = new Gtk.Label({
                label: 'Preparing...',
                css_classes: ['dim-label'],
            });
            progressContainer.append(this._progressLabel);

            this.append(progressContainer);

            // Items list in a scrolled window
            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                max_content_height: 300,
                min_content_height: 100,
                propagate_natural_height: true,
            });

            this._itemsList = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.SM,
            });
            applyCssToWidget(
                this._itemsList,
                `
                box {
                    background-color: @view_bg_color;
                    border: 1px solid alpha(@borders, 0.3);
                    border-radius: 0;
                    padding: ${SPACING.SM}px;
                }
            `
            );

            scrolled.set_child(this._itemsList);
            this.append(scrolled);

            // Cancel button
            this._cancelButton = new Gtk.Button({
                label: 'Cancel',
                halign: Gtk.Align.CENTER,
                margin_top: SPACING.MD,
            });
            applyCssToWidget(
                this._cancelButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 24px;
                }
            `
            );
            this._cancelButton.connect('clicked', () => {
                this.emit('cancel-requested');
            });
            this.append(this._cancelButton);
        }

        /**
         * Initialize the panel with items to process
         * @param {Array<Object>} wallpapers - Array of wallpaper objects
         */
        setItems(wallpapers) {
            this._items = wallpapers.map((wp, index) => ({
                index,
                wallpaper: wp,
                status: 'pending',
            }));

            this._itemRows.clear();
            removeAllChildren(this._itemsList);

            // Create item rows
            for (const item of this._items) {
                const row = this._createItemRow(item);
                this._itemRows.set(item.index, row);
                this._itemsList.append(row);
            }

            this._updateProgress(0, this._items.length);
        }

        /**
         * Create a row for an item
         * @private
         * @param {Object} item - Item data
         * @returns {Gtk.Box} Row widget
         */
        _createItemRow(item) {
            const row = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
            });

            // Status indicator (icon or spinner)
            const statusBox = new Gtk.Box({
                width_request: 24,
                height_request: 24,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
            });

            const statusIcon = new Gtk.Image({
                icon_name: STATUS_ICONS.pending,
            });
            applyCssToWidget(
                statusIcon,
                `
                image {
                    opacity: 0.5;
                }
            `
            );
            statusBox.append(statusIcon);

            row.append(statusBox);
            row._statusBox = statusBox;

            // Wallpaper name
            const nameLabel = new Gtk.Label({
                label: this._getWallpaperName(item.wallpaper),
                xalign: 0,
                hexpand: true,
                ellipsize: 3, // PANGO_ELLIPSIZE_END
            });
            row.append(nameLabel);

            return row;
        }

        /**
         * Get wallpaper display name
         * @private
         * @param {Object} wallpaper - Wallpaper object
         * @returns {string} Display name
         */
        _getWallpaperName(wallpaper) {
            return (
                wallpaper?.name ||
                wallpaper?.path?.split('/').pop() ||
                'Unknown'
            );
        }

        /**
         * Update progress for an item starting
         * @param {number} index - Item index
         */
        markItemStarted(index) {
            if (index < 0 || index >= this._items.length) return;

            this._items[index].status = 'processing';

            const row = this._itemRows.get(index);
            if (row) {
                removeAllChildren(row._statusBox);

                const spinner = new Gtk.Spinner({
                    width_request: 20,
                    height_request: 20,
                });
                spinner.start();
                row._statusBox.append(spinner);
            }

            this._updateProgress(index, this._items.length);
        }

        /**
         * Update progress for an item completed successfully
         * @param {number} index - Item index
         */
        markItemCompleted(index) {
            if (index < 0 || index >= this._items.length) return;

            this._items[index].status = 'completed';

            const row = this._itemRows.get(index);
            if (row) {
                removeAllChildren(row._statusBox);

                const icon = new Gtk.Image({
                    icon_name: STATUS_ICONS.completed,
                });
                applyCssToWidget(
                    icon,
                    `
                    image {
                        color: @success_bg_color;
                    }
                `
                );
                row._statusBox.append(icon);
            }

            this._updateProgress(index + 1, this._items.length);
        }

        /**
         * Update progress for an item that failed
         * @param {number} index - Item index
         * @param {string} [errorMessage] - Error message
         */
        markItemFailed(index, errorMessage = null) {
            if (index < 0 || index >= this._items.length) return;

            this._items[index].status = 'failed';
            this._items[index].error = errorMessage;

            const row = this._itemRows.get(index);
            if (row) {
                removeAllChildren(row._statusBox);

                const icon = new Gtk.Image({
                    icon_name: STATUS_ICONS.failed,
                    tooltip_text: errorMessage || 'Failed',
                });
                applyCssToWidget(
                    icon,
                    `
                    image {
                        color: @error_bg_color;
                    }
                `
                );
                row._statusBox.append(icon);
            }

            this._updateProgress(index + 1, this._items.length);
        }

        /**
         * Update overall progress display
         * @private
         * @param {number} current - Current item number
         * @param {number} total - Total items
         */
        _updateProgress(current, total) {
            const fraction = total > 0 ? current / total : 0;
            this._progressBar.set_fraction(fraction);
            this._progressBar.set_text(`${Math.round(fraction * 100)}%`);

            const completed = this._items.filter(
                i => i.status === 'completed' || i.status === 'failed'
            ).length;
            this._progressLabel.set_label(
                `${completed} of ${total} wallpapers processed`
            );
        }

        /**
         * Show completion state
         * @param {number} successCount - Number of successful items
         * @param {number} failCount - Number of failed items
         */
        showComplete(successCount, failCount) {
            this._progressBar.set_fraction(1);
            this._progressBar.set_text('Complete');

            let message = `${successCount} wallpaper${successCount !== 1 ? 's' : ''} processed successfully`;
            if (failCount > 0) {
                message += `, ${failCount} failed`;
            }
            this._progressLabel.set_label(message);

            this._cancelButton.set_label('Continue');
        }

        /**
         * Show cancelled state
         */
        showCancelled() {
            this._progressLabel.set_label('Processing cancelled');
            this._cancelButton.set_label('Close');
        }

        /**
         * Enable or disable the cancel button
         * @param {boolean} enabled - Whether button should be enabled
         */
        setCancelEnabled(enabled) {
            this._cancelButton.set_sensitive(enabled);
        }

        /**
         * Set the cancel button label
         * @param {string} label - Button label
         */
        setCancelLabel(label) {
            this._cancelButton.set_label(label);
        }
    }
);
