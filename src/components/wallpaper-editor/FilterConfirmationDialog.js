import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

/**
 * FilterConfirmationDialog - Safety countdown dialog for filter application
 *
 * Modal dialog that appears after applying wallpaper filters, requiring explicit
 * user confirmation within a time limit (default 60 seconds). Automatically reverts
 * changes if the user doesn't confirm within the timeout period.
 *
 * This prevents users from getting stuck with filters that make the UI unusable
 * (e.g., extreme CRT warping, heavy blur, inverted colors).
 *
 * Similar to display resolution confirmation dialogs in most operating systems.
 *
 * Features:
 * - Live countdown timer showing remaining seconds
 * - "Keep Changes" button (suggested action, primary)
 * - "Revert" button (destructive action)
 * - Automatic revert on timeout
 * - Keyboard shortcuts: Escape = Revert, Enter = Keep
 * - Cancels timeout when user makes a choice
 *
 * Dialog Response Codes:
 * - 'keep': User confirmed changes (or pressed Enter)
 * - 'revert': User rejected changes (or pressed Escape, or timeout expired)
 *
 * @example
 * const dialog = new FilterConfirmationDialog(parentWindow, 60);
 * const response = await dialog.show();
 * if (response === 'keep') {
 *     console.log('User confirmed filter changes');
 * } else {
 *     console.log('User reverted or timeout expired');
 * }
 */
export const FilterConfirmationDialog = GObject.registerClass(
    class FilterConfirmationDialog extends Adw.MessageDialog {
        /**
         * Creates a new filter confirmation dialog
         *
         * @param {Gtk.Window} parent - Parent window for modal behavior
         * @param {number} timeoutSeconds - Countdown duration in seconds (default: 60)
         */
        _init(parent, timeoutSeconds = 60) {
            super._init({
                transient_for: parent,
                modal: true,
                heading: 'Keep Filter Changes?',
                body: 'Do you want to keep these filter changes?',
            });

            this._timeoutSeconds = timeoutSeconds;
            this._remainingSeconds = timeoutSeconds;
            this._timeoutId = null;
            this._resolvePromise = null;

            this._buildUI();
            this._startCountdown();
        }

        /**
         * Builds the dialog UI with countdown and action buttons
         * @private
         */
        _buildUI() {
            // Add countdown label
            this._countdownLabel = new Gtk.Label({
                label: this._formatCountdown(this._remainingSeconds),
                css_classes: ['title-2'],
                margin_top: 12,
                margin_bottom: 12,
            });

            // Add extra child for countdown display
            this.set_extra_child(this._countdownLabel);

            // Add action buttons
            this.add_response('revert', 'Revert');
            this.add_response('keep', 'Keep Changes');

            // Style buttons
            this.set_response_appearance(
                'revert',
                Adw.ResponseAppearance.DESTRUCTIVE
            );
            this.set_response_appearance(
                'keep',
                Adw.ResponseAppearance.SUGGESTED
            );

            // Set default response (Enter key)
            this.set_default_response('keep');

            // Set close response (Escape key, window close button)
            this.set_close_response('revert');

            // Connect response signal
            this.connect('response', (dialog, response) => {
                this._onResponse(response);
            });
        }

        /**
         * Starts the countdown timer
         * @private
         */
        _startCountdown() {
            // Update countdown every second
            this._timeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                1,
                () => {
                    this._remainingSeconds--;

                    if (this._remainingSeconds <= 0) {
                        // Timeout expired - auto-revert
                        this._onTimeout();
                        return GLib.SOURCE_REMOVE;
                    }

                    // Update label
                    this._countdownLabel.set_label(
                        this._formatCountdown(this._remainingSeconds)
                    );

                    // Continue timer
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        /**
         * Stops the countdown timer
         * @private
         */
        _stopCountdown() {
            if (this._timeoutId !== null) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
        }

        /**
         * Formats countdown display string
         * @private
         * @param {number} seconds - Remaining seconds
         * @returns {string} Formatted countdown string
         */
        _formatCountdown(seconds) {
            if (seconds <= 10) {
                return `Reverting in ${seconds} second${seconds !== 1 ? 's' : ''}...`;
            }
            return `Reverting in ${seconds} seconds`;
        }

        /**
         * Handles timeout expiration
         * @private
         */
        _onTimeout() {
            console.log('Filter confirmation timeout - auto-reverting');
            this._stopCountdown();
            this.close();
            if (this._resolvePromise) {
                this._resolvePromise('revert');
            }
        }

        /**
         * Handles dialog response (button click)
         * @private
         * @param {string} response - Response ID ('keep' or 'revert')
         */
        _onResponse(response) {
            this._stopCountdown();

            if (this._resolvePromise) {
                this._resolvePromise(response);
            }
        }

        /**
         * Shows the dialog and returns a promise that resolves with the user's choice
         *
         * @returns {Promise<string>} Promise that resolves to 'keep' or 'revert'
         *
         * @example
         * const dialog = new FilterConfirmationDialog(window);
         * const response = await dialog.show();
         * if (response === 'keep') {
         *     applyChanges();
         * } else {
         *     revertChanges();
         * }
         */
        show() {
            return new Promise(resolve => {
                this._resolvePromise = resolve;
                this.present();
            });
        }

        /**
         * Cleanup when dialog is destroyed
         * @private
         */
        vfunc_unmap() {
            this._stopCountdown();
            super.vfunc_unmap();
        }
    }
);
