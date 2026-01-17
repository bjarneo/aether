/**
 * HistoryManager - Manages undo/redo history stack for theme state
 *
 * Provides history tracking with configurable max size and snapshot-based
 * state restoration. Emits signals when history state changes.
 *
 * @module HistoryManager
 */

import GObject from 'gi://GObject';

/**
 * @typedef {Object} HistorySnapshot
 * @property {string[]} palette - 16-color palette array
 * @property {Object} extendedColors - Extended color overrides
 * @property {Object} adjustments - Color adjustments
 * @property {boolean} lightMode - Light mode state
 * @property {string} action - Description of what changed
 */

/**
 * HistoryManager - Manages undo/redo stack for theme changes
 *
 * @class
 * @extends {GObject.Object}
 *
 * @fires HistoryManager#history-changed - When history state changes
 */
export const HistoryManager = GObject.registerClass(
    {
        Signals: {
            'history-changed': {},
        },
    },
    class HistoryManager extends GObject.Object {
        /**
         * Initialize history manager
         */
        _init() {
            super._init();

            /** @private @type {HistorySnapshot[]} */
            this._stack = [];

            /** @private @type {number} */
            this._index = -1;

            /** @private @type {number} */
            this._maxSize = 50;

            /** @private @type {boolean} */
            this._isRestoring = false;
        }

        /**
         * Check if currently restoring state (to prevent re-capture)
         * @returns {boolean} Whether restoration is in progress
         */
        get isRestoring() {
            return this._isRestoring;
        }

        /**
         * Push a new snapshot onto the history stack
         * Truncates any forward history (redo stack)
         * @param {HistorySnapshot} snapshot - State snapshot to save
         */
        push(snapshot) {
            if (this._isRestoring) return;

            // Truncate forward history
            this._stack = this._stack.slice(0, this._index + 1);

            // Add new snapshot
            this._stack.push(snapshot);
            this._index = this._stack.length - 1;

            // Enforce max size
            if (this._stack.length > this._maxSize) {
                this._stack.shift();
                this._index--;
            }

            this.emit('history-changed');
        }

        /**
         * Navigate history stack and return snapshot
         * @private
         * @param {number} direction - Direction to move (-1 for undo, +1 for redo)
         * @returns {HistorySnapshot|null} Snapshot or null if navigation not possible
         */
        _navigate(direction) {
            const canNavigate = direction < 0 ? this.canUndo() : this.canRedo();
            if (!canNavigate) return null;

            this._isRestoring = true;
            this._index += direction;
            const snapshot = this._stack[this._index];
            this._isRestoring = false;

            this.emit('history-changed');
            return snapshot;
        }

        /**
         * Undo - restore previous state
         * @returns {HistorySnapshot|null} Previous snapshot or null
         */
        undo() {
            return this._navigate(-1);
        }

        /**
         * Redo - restore next state
         * @returns {HistorySnapshot|null} Next snapshot or null
         */
        redo() {
            return this._navigate(1);
        }

        /**
         * Check if undo is available
         * @returns {boolean} Whether undo is possible
         */
        canUndo() {
            return this._index > 0;
        }

        /**
         * Check if redo is available
         * @returns {boolean} Whether redo is possible
         */
        canRedo() {
            return this._index < this._stack.length - 1;
        }

        /**
         * Clear all history
         */
        clear() {
            this._stack = [];
            this._index = -1;
            this.emit('history-changed');
        }

        /**
         * Get current history stats (for debugging)
         * @returns {Object} History statistics
         */
        getStats() {
            return {
                size: this._stack.length,
                index: this._index,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
            };
        }
    }
);
