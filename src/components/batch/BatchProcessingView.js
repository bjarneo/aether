/**
 * BatchProcessingView - Main container view for batch wallpaper processing
 *
 * Uses a stack to show:
 * - Processing phase: BatchProgressPanel
 * - Comparison phase: BatchResultsGrid
 *
 * Signals:
 * - 'theme-selected' (result) - When a theme is selected for application
 * - 'cancelled' - When processing is cancelled or user wants to go back
 *
 * @module BatchProcessingView
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {BatchProgressPanel} from './BatchProgressPanel.js';
import {BatchResultsGrid} from './BatchResultsGrid.js';
import {batchProcessingService} from '../../services/BatchProcessingService.js';
import {batchProcessingState} from '../../state/BatchProcessingState.js';
import {themeState} from '../../state/ThemeState.js';
import {SPACING} from '../../constants/ui-constants.js';
import {SignalTracker} from '../../utils/signal-tracker.js';
import {createLogger} from '../../utils/logger.js';

const log = createLogger('BatchProcessingView');

/**
 * BatchProcessingView - Container for batch processing workflow
 * @class
 * @extends {Gtk.Box}
 */
export const BatchProcessingView = GObject.registerClass(
    {
        Signals: {
            'theme-selected': {param_types: [GObject.TYPE_JSOBJECT]},
            cancelled: {},
        },
    },
    class BatchProcessingView extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            /** @private @type {SignalTracker} */
            this._signals = new SignalTracker();

            this._initializeUI();
            this._connectSignals();
        }

        _initializeUI() {
            this._contentStack = new Gtk.Stack({
                vexpand: true,
                transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
                transition_duration: 200,
            });

            this._progressPanel = new BatchProgressPanel();
            this._progressPanel.connect('cancel-requested', () =>
                this._onCancelRequested()
            );
            this._contentStack.add_named(this._progressPanel, 'processing');

            this._resultsGrid = new BatchResultsGrid();
            this._resultsGrid.connect('theme-selected', (_, result) =>
                this._onThemeSelected(result)
            );
            this._resultsGrid.connect('preview-requested', (_, result) =>
                this._onPreviewRequested(result)
            );
            this._contentStack.add_named(this._resultsGrid, 'comparison');

            this.append(this._contentStack);
        }

        /**
         * Connect to service and state signals
         * @private
         */
        _connectSignals() {
            this._signals.track(
                batchProcessingService,
                'item-started',
                (_, index) => {
                    this._progressPanel.markItemStarted(index);
                }
            );

            this._signals.track(
                batchProcessingService,
                'item-completed',
                (_, index) => {
                    this._progressPanel.markItemCompleted(index);
                }
            );

            this._signals.track(
                batchProcessingService,
                'item-failed',
                (_, index, error) => {
                    this._progressPanel.markItemFailed(index, error);
                }
            );

            this._signals.track(
                batchProcessingService,
                'processing-completed',
                (_, results) => {
                    this._onProcessingCompleted(results);
                }
            );

            this._signals.track(
                batchProcessingService,
                'processing-cancelled',
                () => {
                    this._onProcessingCancelled();
                }
            );

            this._signals.track(
                batchProcessingState,
                'phase-changed',
                (_, phase) => {
                    this._onPhaseChanged(phase);
                }
            );
        }

        /**
         * Start processing selected wallpapers
         * @param {Array<Object>} wallpapers - Wallpapers to process
         */
        async startProcessing(wallpapers) {
            if (!wallpapers || wallpapers.length === 0) {
                log.warn('No wallpapers to process');
                return;
            }

            log.info(
                `Starting batch processing of ${wallpapers.length} wallpapers`
            );

            // Clear previous state
            batchProcessingService.reset();

            // Add wallpapers to queue
            batchProcessingService.addToQueue(wallpapers);

            // Setup progress panel
            this._progressPanel.setItems(wallpapers);
            this._progressPanel.setCancelLabel('Cancel');
            this._progressPanel.setCancelEnabled(true);

            // Show processing panel
            this._contentStack.set_visible_child_name('processing');
            batchProcessingState.setPhase('processing');

            // Get light mode from theme state
            const lightMode = themeState.getLightMode();

            // Start processing
            await batchProcessingService.processQueue(lightMode);
        }

        /**
         * Handle processing completed
         * @private
         * @param {Array<Object>} results - Processing results
         */
        _onProcessingCompleted(results) {
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            log.info(
                `Processing completed: ${successful.length} success, ${failed.length} failed`
            );

            this._progressPanel.showComplete(successful.length, failed.length);
            this._progressPanel.setCancelLabel('View Results');

            // Transition to comparison after a short delay
            setTimeout(() => {
                this._showComparison(results);
            }, 1000);
        }

        /**
         * Handle processing cancelled
         * @private
         */
        _onProcessingCancelled() {
            log.info('Processing cancelled');

            this._progressPanel.showCancelled();
            this._progressPanel.setCancelLabel('Close');

            // Allow user to view partial results if any
            const results = batchProcessingService.getResults();
            if (results.length > 0) {
                this._progressPanel.setCancelLabel('View Results');
            }
        }

        /**
         * Show comparison view with results
         * @private
         * @param {Array<Object>} results - Results to show
         */
        _showComparison(results) {
            this._resultsGrid.setResults(results);
            this._contentStack.set_visible_child_name('comparison');
            batchProcessingState.setPhase('comparison');
        }

        /**
         * Handle cancel button click
         * @private
         */
        _onCancelRequested() {
            if (batchProcessingService.isProcessing()) {
                // Cancel ongoing processing
                batchProcessingService.cancel();
            } else {
                // Processing is done - either show results or emit cancelled
                const results = batchProcessingService.getResults();
                if (results.length > 0 && results.some(r => r.success)) {
                    this._showComparison(results);
                } else {
                    this.emit('cancelled');
                }
            }
        }

        /**
         * Handle phase changes from state
         * @private
         * @param {string} phase - New phase
         */
        _onPhaseChanged(phase) {
            const pageMap = {
                processing: 'processing',
                comparison: 'comparison',
            };
            const pageName = pageMap[phase];
            if (pageName) {
                this._contentStack.set_visible_child_name(pageName);
            }
        }

        /**
         * Handle theme selection from results grid
         * @private
         * @param {Object|null} result - Selected result or null for start over
         */
        _onThemeSelected(result) {
            if (result === null) {
                // User clicked "Start Over"
                this.emit('cancelled');
                return;
            }

            log.info(`Theme selected: ${result.wallpaper?.path}`);
            this.emit('theme-selected', result);
        }

        /**
         * Handle preview request
         * @private
         * @param {Object} result - Result to preview
         */
        _onPreviewRequested(result) {
            if (!result?.success) return;

            log.info(`Preview requested: ${result.wallpaper?.path}`);

            // Apply to theme state for preview (without persisting)
            themeState.setWallpaper(result.wallpaper.path);
            themeState.setPalette(result.colors, {resetExtended: true});
        }

        /**
         * Get the currently selected result
         * @returns {Object|null} Selected result
         */
        getSelectedResult() {
            return this._resultsGrid.getSelectedResult();
        }

        /**
         * Reset the view to initial state
         */
        reset() {
            batchProcessingService.reset();
            this._resultsGrid.setResults([]);
            this._contentStack.set_visible_child_name('processing');
        }

        /**
         * Clean up on widget destruction
         */
        vfunc_unroot() {
            this._signals.disconnectAll();
            super.vfunc_unroot();
        }
    }
);
