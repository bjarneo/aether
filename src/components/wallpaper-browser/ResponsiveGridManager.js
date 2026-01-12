import GLib from 'gi://GLib';

/**
 * ResponsiveGridManager - Manages responsive column layout for wallpaper grid
 *
 * Automatically adjusts grid columns (2-4) based on available width with
 * efficient resize detection using polling with change threshold.
 *
 * Features:
 * - Window-based width calculation for initial layout
 * - Efficient polling (1s interval) with change threshold (50px)
 * - Smooth responsive breakpoints (2-4 columns)
 * - Automatic cleanup on widget destruction
 * - Cached column spacing for performance
 *
 * Responsive Breakpoints:
 * - < 600px: 2 columns
 * - 600-880px: 3 columns
 * - >= 880px: 4 columns (capped to ensure grid stays tall enough for scrolling)
 *
 * @example
 * const manager = new ResponsiveGridManager(gridFlow, scrolledWindow, widget);
 * manager.initialize();
 * // Automatic column updates based on window resize
 * // Cleanup happens automatically on widget destroy
 */
export class ResponsiveGridManager {
    /**
     * Creates a new ResponsiveGridManager
     * @param {Gtk.FlowBox} gridFlow - The FlowBox to manage
     * @param {Gtk.ScrolledWindow} scrolledWindow - Parent scrolled window
     * @param {Gtk.Widget} widget - Parent widget (for signals)
     */
    constructor(gridFlow, scrolledWindow, widget) {
        this._gridFlow = gridFlow;
        this._scrolledWindow = scrolledWindow;
        this._widget = widget;

        // Responsive grid constants
        this.LAYOUT_CONSTANTS = {
            MIN_COLUMNS: 2, // Minimum columns to maintain usable grid
            FALLBACK_WIDTH: 1200, // Default width when allocation unavailable
            CONTENT_WIDTH_RATIO: 0.65, // Content area ratio of total window (accounts for sidebar)
            WINDOW_SCROLL_THRESHOLD: 2, // Window must be 2x scroll width to use window-based calculation
            MIN_WINDOW_WIDTH: 1200, // Minimum window width to apply window-based calculation
            ITEM_WIDTH: 280, // Width of each wallpaper item
            GRID_MARGINS: 24, // Total margins (12px left + 12px right)
            CHANGE_THRESHOLD: 50, // Minimum width change (px) to trigger column recalculation
            INITIAL_DELAY: 300, // Initial delay (ms) before first column calculation
            POLLING_INTERVAL: 1000, // Polling interval (ms) for resize detection
        };

        this._lastWidth = 0;
        this._resizeTimeoutId = null;
        this._isCleanedUp = false;

        // Cache column spacing to avoid repeated method calls
        this._cachedColumnSpacing = this._gridFlow.get_column_spacing();
    }

    /**
     * Initializes responsive column management
     * Sets up initial column count and resize detection
     */
    initialize() {
        // Initial update after delay
        GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.LAYOUT_CONSTANTS.INITIAL_DELAY,
            () => {
                this._updateColumns();
                return GLib.SOURCE_REMOVE;
            }
        );

        // Connect to size allocation signals for efficient resize detection
        this._widget.connect('realize', () => {
            this._connectResizeSignals();
        });

        // Cleanup when component is destroyed
        this._widget.connect('destroy', () => {
            this.cleanup();
        });
    }

    /**
     * Connects resize detection signals using efficient polling
     * Only triggers column recalculation when width changes exceed threshold
     * @private
     */
    _connectResizeSignals() {
        // Use efficient polling with change detection
        // Check at POLLING_INTERVAL, but only update if width changed significantly
        this._resizeTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.LAYOUT_CONSTANTS.POLLING_INTERVAL,
            () => {
                const width = this._getAvailableWidth();
                if (
                    Math.abs(width - this._lastWidth) >
                    this.LAYOUT_CONSTANTS.CHANGE_THRESHOLD
                ) {
                    this._updateColumns();
                    this._lastWidth = width;
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    /**
     * Calculates available width for the wallpaper grid
     * Uses window-based calculation when scroll area hasn't expanded yet
     * Falls back to scroll area width or default fallback width
     * @returns {number} Available width in pixels
     * @private
     */
    _getAvailableWidth() {
        const scrollWidth = this._scrolledWindow.get_allocated_width();
        const window = this._widget.get_root();
        const windowWidth = window?.get_allocated_width() || 0;

        // Use window-based calculation if scroll area hasn't expanded yet
        const shouldUseWindowWidth =
            windowWidth >
                scrollWidth * this.LAYOUT_CONSTANTS.WINDOW_SCROLL_THRESHOLD &&
            windowWidth > this.LAYOUT_CONSTANTS.MIN_WINDOW_WIDTH;

        return shouldUseWindowWidth
            ? windowWidth * this.LAYOUT_CONSTANTS.CONTENT_WIDTH_RATIO
            : scrollWidth || this.LAYOUT_CONSTANTS.FALLBACK_WIDTH;
    }

    /**
     * Updates the grid's column count based on available width
     * Sets both max and min columns for responsive behavior
     * @private
     */
    _updateColumns() {
        const width = this._getAvailableWidth();
        const columns = this._calculateColumns(width);

        if (this._gridFlow.get_max_children_per_line() !== columns) {
            this._gridFlow.set_max_children_per_line(columns);

            // Set min to columns-1, but never below MIN_COLUMNS
            const minColumns = Math.max(
                this.LAYOUT_CONSTANTS.MIN_COLUMNS,
                columns - 1
            );
            this._gridFlow.set_min_children_per_line(minColumns);
        }
    }

    /**
     * Calculates optimal number of columns based on available width
     * Applies responsive breakpoints (2-4 columns) based on width
     * Capped at 4 columns to ensure grid remains tall enough for scrolling
     * @param {number} width - Available width in pixels
     * @returns {number} Number of columns (2-4)
     * @private
     */
    _calculateColumns(width) {
        // Use cached spacing value for better performance
        const itemSize =
            this.LAYOUT_CONSTANTS.ITEM_WIDTH + this._cachedColumnSpacing;
        const availableWidth = width - this.LAYOUT_CONSTANTS.GRID_MARGINS;
        const calculated = Math.floor(availableWidth / itemSize);

        // Apply responsive breakpoints with boundaries
        // Cap at 4 columns max to ensure grid stays tall enough for scrolling
        // This prevents GTK from hiding scrollbar when grid becomes too short
        // 2 columns: < 600px
        // 3 columns: 600-880px
        // 4 columns: >= 880px
        if (calculated < 2) return 2;
        if (calculated > 4) return 4;
        return calculated;
    }

    /**
     * Cleans up resize detection resources when widget is destroyed
     * Removes timeout handlers and sets cleanup flag
     */
    cleanup() {
        // Guard against double cleanup
        if (this._isCleanedUp) {
            return;
        }
        this._isCleanedUp = true;

        // Cleanup timeout
        if (this._resizeTimeoutId) {
            GLib.source_remove(this._resizeTimeoutId);
            this._resizeTimeoutId = null;
        }
    }
}
