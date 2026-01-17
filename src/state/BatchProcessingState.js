/**
 * BatchProcessingState - Tracks batch workflow state (selection, phase, preview)
 *
 * Manages the UI state for batch wallpaper processing workflow:
 * - Selection tracking across different browser views
 * - Phase management (idle, selection, processing, comparison)
 * - Preview index for comparison view
 *
 * Signals:
 * - 'selection-changed' - When selections are added/removed
 * - 'phase-changed' - When workflow phase changes
 * - 'preview-changed' - When preview index changes
 *
 * @module BatchProcessingState
 */

import GObject from 'gi://GObject';

/**
 * Workflow phases
 * @typedef {'idle' | 'selection' | 'processing' | 'comparison'} Phase
 */

/**
 * BatchProcessingState - UI state for batch processing workflow
 * @class
 * @extends {GObject.Object}
 */
export const BatchProcessingState = GObject.registerClass(
    {
        Signals: {
            'selection-changed': {param_types: [GObject.TYPE_INT]},
            'phase-changed': {param_types: [GObject.TYPE_STRING]},
            'preview-changed': {param_types: [GObject.TYPE_INT]},
            'selection-mode-changed': {param_types: [GObject.TYPE_BOOLEAN]},
        },
    },
    class BatchProcessingState extends GObject.Object {
        _init() {
            super._init();

            /** @private @type {Map<string, Object>} Selected wallpapers by path */
            this._selections = new Map();

            /** @private @type {Phase} Current workflow phase */
            this._phase = 'idle';

            /** @private @type {number} Currently previewed result index (-1 for none) */
            this._previewIndex = -1;

            /** @private @type {boolean} Whether selection mode is active */
            this._selectionMode = false;

            /** @private @type {number} Maximum selections allowed */
            this._maxSelections = 10;
        }

        // ==================== Selection Mode ====================

        /**
         * Check if selection mode is active
         * @returns {boolean} Whether selection mode is enabled
         */
        isSelectionMode() {
            return this._selectionMode;
        }

        /**
         * Enable or disable selection mode
         * @param {boolean} enabled - Whether to enable selection mode
         */
        setSelectionMode(enabled) {
            if (this._selectionMode === enabled) return;

            this._selectionMode = enabled;

            if (!enabled) {
                // Clear selections when exiting selection mode
                this._selections.clear();
                this.emit('selection-changed', 0);
            }

            this.emit('selection-mode-changed', enabled);
        }

        /**
         * Toggle selection mode
         * @returns {boolean} New selection mode state
         */
        toggleSelectionMode() {
            this.setSelectionMode(!this._selectionMode);
            return this._selectionMode;
        }

        // ==================== Selections ====================

        /**
         * Add a wallpaper to selection
         * @param {Object} wallpaper - Wallpaper object with path property
         * @returns {boolean} Whether wallpaper was added (false if at max)
         */
        addSelection(wallpaper) {
            if (!wallpaper?.path) return false;

            if (this._selections.size >= this._maxSelections) {
                return false;
            }

            if (this._selections.has(wallpaper.path)) {
                return true; // Already selected
            }

            this._selections.set(wallpaper.path, wallpaper);
            this.emit('selection-changed', this._selections.size);
            return true;
        }

        /**
         * Remove a wallpaper from selection
         * @param {string} path - Wallpaper path to remove
         */
        removeSelection(path) {
            if (this._selections.delete(path)) {
                this.emit('selection-changed', this._selections.size);
            }
        }

        /**
         * Toggle selection for a wallpaper
         * @param {Object} wallpaper - Wallpaper object with path property
         * @returns {boolean} New selection state (true = selected)
         */
        toggleSelection(wallpaper) {
            if (!wallpaper?.path) return false;

            if (this._selections.has(wallpaper.path)) {
                this.removeSelection(wallpaper.path);
                return false;
            } else {
                return this.addSelection(wallpaper);
            }
        }

        /**
         * Check if a wallpaper is selected
         * @param {string} path - Wallpaper path to check
         * @returns {boolean} Whether wallpaper is selected
         */
        isSelected(path) {
            return this._selections.has(path);
        }

        /**
         * Get all selected wallpapers
         * @returns {Array<Object>} Array of selected wallpaper objects
         */
        getSelections() {
            return Array.from(this._selections.values());
        }

        /**
         * Get selected wallpaper paths
         * @returns {Array<string>} Array of selected paths
         */
        getSelectionPaths() {
            return Array.from(this._selections.keys());
        }

        /**
         * Get selection count
         * @returns {number} Number of selected wallpapers
         */
        getSelectionCount() {
            return this._selections.size;
        }

        /**
         * Clear all selections
         */
        clearSelections() {
            if (this._selections.size > 0) {
                this._selections.clear();
                this.emit('selection-changed', 0);
            }
        }

        /**
         * Check if at maximum selection limit
         * @returns {boolean} Whether max selections reached
         */
        isAtMaxSelections() {
            return this._selections.size >= this._maxSelections;
        }

        /**
         * Get maximum selections allowed
         * @returns {number} Maximum selection count
         */
        getMaxSelections() {
            return this._maxSelections;
        }

        // ==================== Phase ====================

        /**
         * Get current workflow phase
         * @returns {Phase} Current phase
         */
        getPhase() {
            return this._phase;
        }

        /**
         * Set workflow phase
         * @param {Phase} phase - New phase
         */
        setPhase(phase) {
            const validPhases = [
                'idle',
                'selection',
                'processing',
                'comparison',
            ];
            if (!validPhases.includes(phase)) {
                console.error(`Invalid phase: ${phase}`);
                return;
            }

            if (this._phase === phase) return;

            this._phase = phase;
            this.emit('phase-changed', phase);
        }

        /**
         * Check if in a specific phase
         * @param {Phase} phase - Phase to check
         * @returns {boolean} Whether currently in that phase
         */
        isPhase(phase) {
            return this._phase === phase;
        }

        // ==================== Preview ====================

        /**
         * Get currently previewed result index
         * @returns {number} Preview index (-1 for none)
         */
        getPreviewIndex() {
            return this._previewIndex;
        }

        /**
         * Set preview index
         * @param {number} index - Index to preview (-1 for none)
         */
        setPreviewIndex(index) {
            if (this._previewIndex === index) return;

            this._previewIndex = index;
            this.emit('preview-changed', index);
        }

        /**
         * Clear preview
         */
        clearPreview() {
            this.setPreviewIndex(-1);
        }

        // ==================== Reset ====================

        /**
         * Reset all state to defaults
         * @param {Object} [options] - Reset options
         * @param {boolean} [options.keepSelections] - Keep selections when resetting
         */
        reset(options = {}) {
            if (!options.keepSelections) {
                this._selections.clear();
                this.emit('selection-changed', 0);
            }

            this._phase = 'idle';
            this._previewIndex = -1;
            this._selectionMode = false;

            this.emit('phase-changed', 'idle');
            this.emit('preview-changed', -1);
            this.emit('selection-mode-changed', false);
        }
    }
);

/**
 * Singleton instance for global access
 * @type {BatchProcessingState}
 */
export const batchProcessingState = new BatchProcessingState();
