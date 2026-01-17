/**
 * BatchProcessingService - Queue management and async processing for batch wallpaper operations
 *
 * Handles sequential color extraction from multiple wallpapers with progress feedback.
 *
 * Signals:
 * - 'queue-changed' - When items are added/removed from queue
 * - 'item-started' (index, wallpaper) - When processing starts for an item
 * - 'item-completed' (index, result) - When an item finishes successfully
 * - 'item-failed' (index, error) - When an item fails
 * - 'processing-started' - When batch processing begins
 * - 'processing-completed' (results) - When all items are done
 * - 'processing-cancelled' - When processing is cancelled
 *
 * @module BatchProcessingService
 */

import GObject from 'gi://GObject';

import {extractColorsWithImageMagick} from '../utils/color-extraction.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('BatchProcessingService');

/** Maximum number of wallpapers that can be processed in a batch */
const MAX_BATCH_SIZE = 10;

/**
 * BatchProcessingService - Manages batch wallpaper color extraction
 * @class
 * @extends {GObject.Object}
 */
export const BatchProcessingService = GObject.registerClass(
    {
        Signals: {
            'queue-changed': {param_types: [GObject.TYPE_INT]},
            'item-started': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_JSOBJECT],
            },
            'item-completed': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_JSOBJECT],
            },
            'item-failed': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_STRING],
            },
            'processing-started': {},
            'processing-completed': {param_types: [GObject.TYPE_JSOBJECT]},
            'processing-cancelled': {},
        },
    },
    class BatchProcessingService extends GObject.Object {
        _init() {
            super._init();

            /** @private @type {Array<Object>} Queue of wallpapers to process */
            this._queue = [];

            /** @private @type {Array<Object>} Results from processing */
            this._results = [];

            /** @private @type {boolean} Whether processing is in progress */
            this._isProcessing = false;

            /** @private @type {boolean} Whether processing should be cancelled */
            this._cancelled = false;

            /** @private @type {number} Current processing index */
            this._currentIndex = 0;
        }

        /**
         * Add wallpapers to the processing queue
         * @param {Array<Object>} wallpapers - Array of wallpaper objects with path property
         * @returns {boolean} Whether items were added successfully
         */
        addToQueue(wallpapers) {
            if (this._isProcessing) {
                log.warn('Cannot add to queue while processing');
                return false;
            }

            if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
                return false;
            }

            // Limit batch size
            const itemsToAdd = wallpapers.slice(
                0,
                MAX_BATCH_SIZE - this._queue.length
            );

            if (itemsToAdd.length === 0) {
                log.warn(`Queue is full (max ${MAX_BATCH_SIZE} items)`);
                return false;
            }

            this._queue.push(...itemsToAdd);
            this.emit('queue-changed', this._queue.length);

            log.info(
                `Added ${itemsToAdd.length} items to queue (total: ${this._queue.length})`
            );
            return true;
        }

        /**
         * Get queue size
         * @returns {number} Number of items in queue
         */
        getQueueSize() {
            return this._queue.length;
        }

        /**
         * Check if processing is in progress
         * @returns {boolean} Whether processing is active
         */
        isProcessing() {
            return this._isProcessing;
        }

        /**
         * Process all items in the queue sequentially
         * @param {boolean} [lightMode=false] - Whether to generate light mode palettes
         * @returns {Promise<Array<Object>>} Array of results
         */
        async processQueue(lightMode = false) {
            if (this._isProcessing) {
                log.warn('Already processing');
                return this._results;
            }

            if (this._queue.length === 0) {
                log.warn('Queue is empty');
                return [];
            }

            this._isProcessing = true;
            this._cancelled = false;
            this._currentIndex = 0;
            this._results = [];

            this.emit('processing-started');
            log.info(
                `Starting batch processing of ${this._queue.length} wallpapers`
            );

            for (let i = 0; i < this._queue.length; i++) {
                if (this._cancelled) {
                    log.info('Processing cancelled');
                    this._isProcessing = false;
                    this.emit('processing-cancelled');
                    return this._results;
                }

                this._currentIndex = i;
                const wallpaper = this._queue[i];

                this.emit('item-started', i, wallpaper);

                try {
                    const colors = await extractColorsWithImageMagick(
                        wallpaper.path,
                        lightMode
                    );

                    const result = {
                        index: i,
                        wallpaper: wallpaper,
                        colors: colors,
                        success: true,
                    };

                    this._results.push(result);
                    this.emit('item-completed', i, result);
                    log.info(
                        `Completed item ${i + 1}/${this._queue.length}: ${wallpaper.path}`
                    );
                } catch (error) {
                    const errorMessage = error.message || 'Unknown error';
                    const result = {
                        index: i,
                        wallpaper: wallpaper,
                        colors: null,
                        success: false,
                        error: errorMessage,
                    };

                    this._results.push(result);
                    this.emit('item-failed', i, errorMessage);
                    log.error(
                        `Failed item ${i + 1}/${this._queue.length}: ${errorMessage}`
                    );
                }
            }

            this._isProcessing = false;
            this._currentIndex = this._queue.length;

            this.emit('processing-completed', this._results);
            log.info(
                `Batch processing completed: ${this._results.filter(r => r.success).length}/${this._results.length} successful`
            );

            return this._results;
        }

        /**
         * Cancel ongoing processing
         */
        cancel() {
            if (!this._isProcessing) {
                return;
            }

            log.info('Cancelling batch processing');
            this._cancelled = true;
        }

        /**
         * Get processing results
         * @returns {Array<Object>} Array of result objects
         */
        getResults() {
            return [...this._results];
        }

        /**
         * Reset service state
         */
        reset() {
            if (this._isProcessing) {
                this.cancel();
            }

            this._queue = [];
            this._results = [];
            this._currentIndex = 0;
            this._cancelled = false;
            this._isProcessing = false;

            this.emit('queue-changed', 0);
        }
    }
);

/**
 * Singleton instance for global access
 * @type {BatchProcessingService}
 */
export const batchProcessingService = new BatchProcessingService();
