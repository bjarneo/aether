/**
 * BatchResultsGrid - FlowBox grid of BatchThemeCard components for comparison
 *
 * Displays processed wallpapers with their extracted color palettes
 * for side-by-side comparison.
 *
 * Signals:
 * - 'theme-selected' (result) - When a theme card is selected for application
 * - 'preview-requested' (result) - When preview is requested for a result
 *
 * @module BatchResultsGrid
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {BatchThemeCard} from './BatchThemeCard.js';
import {applyCssToWidget, removeAllChildren} from '../../utils/ui-helpers.js';
import {SPACING, GRID} from '../../constants/ui-constants.js';

/**
 * BatchResultsGrid - Comparison grid for batch results
 * @class
 * @extends {Gtk.Box}
 */
export const BatchResultsGrid = GObject.registerClass(
    {
        Signals: {
            'theme-selected': {param_types: [GObject.TYPE_JSOBJECT]},
            'preview-requested': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class BatchResultsGrid extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: SPACING.MD,
            });

            /** @private @type {Array<Object>} Results to display */
            this._results = [];

            /** @private @type {number} Currently selected index (-1 for none) */
            this._selectedIndex = -1;

            /** @private @type {Map<number, BatchThemeCard>} Card widgets by index */
            this._cards = new Map();

            this._initializeUI();
        }

        _initializeUI() {
            // Header with title and action buttons
            const header = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
            });

            const titleLabel = new Gtk.Label({
                label: 'Compare Themes',
                css_classes: ['title-2'],
                xalign: 0,
                hexpand: true,
            });
            header.append(titleLabel);

            this._resultsCountLabel = new Gtk.Label({
                label: '0 themes generated',
                css_classes: ['dim-label'],
            });
            header.append(this._resultsCountLabel);

            this.append(header);

            // Instructions
            const instructions = new Gtk.Label({
                label: 'Click a theme to select it for application',
                css_classes: ['dim-label', 'caption'],
                xalign: 0,
                margin_start: SPACING.MD,
                margin_bottom: SPACING.SM,
            });
            this.append(instructions);

            // Scrolled window for grid
            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            // FlowBox grid
            this._flowBox = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: GRID.MAX_COLUMNS,
                min_children_per_line: GRID.MIN_COLUMNS,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                homogeneous: true,
            });

            this._scrolledWindow.set_child(this._flowBox);
            this.append(this._scrolledWindow);

            // Action bar at bottom
            this._actionBar = this._createActionBar();
            this.append(this._actionBar);
        }

        /**
         * Create the action bar with apply/cancel buttons
         * @private
         * @returns {Gtk.Box} Action bar widget
         */
        _createActionBar() {
            const actionBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_bottom: SPACING.MD,
            });
            applyCssToWidget(
                actionBar,
                `
                box {
                    background-color: alpha(@view_bg_color, 0.8);
                    border: 1px solid alpha(@borders, 0.3);
                    border-radius: 0;
                    padding: ${SPACING.SM}px ${SPACING.MD}px;
                }
            `
            );

            // Selection status
            this._selectionLabel = new Gtk.Label({
                label: 'No theme selected',
                xalign: 0,
                hexpand: true,
            });
            actionBar.append(this._selectionLabel);

            // Start over button
            this._startOverButton = new Gtk.Button({
                label: 'Start Over',
            });
            applyCssToWidget(
                this._startOverButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );
            this._startOverButton.connect('clicked', () => {
                this.emit('theme-selected', null);
            });
            actionBar.append(this._startOverButton);

            // Apply button
            this._applyButton = new Gtk.Button({
                label: 'Apply Selected Theme',
                css_classes: ['suggested-action'],
                sensitive: false,
            });
            applyCssToWidget(
                this._applyButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 16px;
                }
            `
            );
            this._applyButton.connect('clicked', () => {
                if (this._selectedIndex >= 0) {
                    const result = this._results[this._selectedIndex];
                    this.emit('theme-selected', result);
                }
            });
            actionBar.append(this._applyButton);

            return actionBar;
        }

        /**
         * Set results to display
         * @param {Array<Object>} results - Array of processing results
         */
        setResults(results) {
            this._results = results;
            this._selectedIndex = -1;
            this._cards.clear();

            removeAllChildren(this._flowBox);

            // Filter to only show successful results
            const successfulResults = results.filter(r => r.success);

            this._resultsCountLabel.set_label(
                `${successfulResults.length} theme${successfulResults.length !== 1 ? 's' : ''} generated`
            );

            // Create cards for each result
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const card = new BatchThemeCard(result);

                card.connect('selected', () => {
                    this._onCardSelected(i);
                });

                card.connect('preview-requested', () => {
                    this.emit('preview-requested', result);
                });

                this._cards.set(i, card);
                this._flowBox.append(card);
            }

            this._updateSelectionUI();
        }

        /**
         * Handle card selection
         * @private
         * @param {number} index - Index of selected card
         */
        _onCardSelected(index) {
            // Deselect previous
            if (this._selectedIndex >= 0) {
                const prevCard = this._cards.get(this._selectedIndex);
                if (prevCard) {
                    prevCard.setSelected(false);
                }
            }

            // Select new (or toggle off if same)
            if (this._selectedIndex === index) {
                this._selectedIndex = -1;
            } else {
                this._selectedIndex = index;
                const card = this._cards.get(index);
                if (card) {
                    card.setSelected(true);
                }
            }

            this._updateSelectionUI();
        }

        /**
         * Update selection UI state
         * @private
         */
        _updateSelectionUI() {
            const hasSelection = this._selectedIndex >= 0;

            this._applyButton.set_sensitive(
                hasSelection && this._results[this._selectedIndex]?.success
            );

            if (hasSelection) {
                const result = this._results[this._selectedIndex];
                const name =
                    result.wallpaper?.name ||
                    result.wallpaper?.path?.split('/').pop() ||
                    'Unknown';
                this._selectionLabel.set_label(`Selected: ${name}`);
            } else {
                this._selectionLabel.set_label('No theme selected');
            }
        }

        /**
         * Get the currently selected result
         * @returns {Object|null} Selected result or null
         */
        getSelectedResult() {
            return this._selectedIndex >= 0
                ? this._results[this._selectedIndex]
                : null;
        }
    }
);
