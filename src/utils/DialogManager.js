import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import {showToast as showToastHelper} from './ui-helpers.js';

/**
 * DialogManager - Centralized dialog system for consistent UI patterns
 *
 * Provides a unified API for creating common dialog types throughout the
 * Aether application. Simplifies dialog creation by abstracting GTK/Adwaita
 * dialog complexity behind simple configuration objects and callbacks.
 *
 * Supported Dialog Types:
 * 1. Message dialogs - Simple informational messages with OK button
 * 2. Confirmation dialogs - Yes/No questions with confirm callback
 * 3. Text input dialogs - Single-line text entry with validation
 * 4. File picker dialogs - File selection with MIME type filtering
 * 5. Folder picker dialogs - Directory selection
 * 6. Save dialogs - File save location with initial name
 * 7. Blueprint manager dialog - Embedded blueprint manager UI
 *
 * Design Patterns:
 * - Configuration objects: All dialogs accept config objects with named params
 * - Callback functions: onConfirm, onSubmit, onSelect for async responses
 * - Window transience: All dialogs are transient for the parent window
 * - Error handling: Graceful dismissal handling for all file dialogs
 * - Static utilities: Toast notifications and overlay finding
 *
 * Static Methods:
 * - findToastOverlay(widget) - Walks widget hierarchy to find Adw.ToastOverlay
 * - showToast(widget, config) - Shows toast notification from any widget
 *
 * Legacy Methods:
 * - showThemeNameDialog(callback) - Redirects to showTextInput
 * - chooseExportDirectory(callback) - Redirects to showFolderPicker
 * - showSuccessDialog(message) - Redirects to showMessage
 * - showErrorDialog(message) - Redirects to showMessage
 * These are maintained for backward compatibility.
 *
 * @example
 * const dialogManager = new DialogManager(window);
 *
 * // Simple message
 * dialogManager.showMessage({
 *     heading: 'Success',
 *     body: 'Theme applied successfully!',
 *     okText: 'Got it'
 * });
 *
 * // Confirmation with callback
 * dialogManager.showConfirmation({
 *     heading: 'Delete Theme',
 *     body: 'Are you sure you want to delete this theme?',
 *     confirmText: 'Delete',
 *     cancelText: 'Cancel',
 *     onConfirm: () => deleteTheme()
 * });
 *
 * // File picker with MIME types
 * dialogManager.showFilePicker({
 *     title: 'Select Wallpaper',
 *     mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
 *     onSelect: (path) => loadWallpaper(path)
 * });
 *
 * // Toast notification (static method)
 * DialogManager.showToast(widget, {
 *     title: 'Theme saved',
 *     timeout: 2
 * });
 */
export class DialogManager {
    constructor(window) {
        this.window = window;
    }

    /**
     * Show a simple message dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.heading - Dialog heading
     * @param {string} config.body - Dialog body text
     * @param {string} config.okText - OK button text (default: "OK")
     */
    showMessage(config) {
        const {heading, body, okText = 'OK'} = config;

        const dialog = new Adw.MessageDialog({
            heading,
            body,
            transient_for: this.window,
        });

        dialog.add_response('ok', okText);
        dialog.present();
    }

    /**
     * Show a confirmation dialog with callback
     * @param {Object} config - Dialog configuration
     * @param {string} config.heading - Dialog heading
     * @param {string} config.body - Dialog body text
     * @param {string} config.confirmText - Confirm button text (default: "Confirm")
     * @param {string} config.cancelText - Cancel button text (default: "Cancel")
     * @param {Function} config.onConfirm - Callback when confirmed
     */
    showConfirmation(config) {
        const {
            heading,
            body,
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            onConfirm,
        } = config;

        const dialog = new Adw.MessageDialog({
            heading,
            body,
            transient_for: this.window,
        });

        dialog.add_response('cancel', cancelText);
        dialog.add_response('confirm', confirmText);
        dialog.set_response_appearance(
            'confirm',
            Adw.ResponseAppearance.SUGGESTED
        );

        dialog.connect('response', (_, response) => {
            if (response === 'confirm' && onConfirm) {
                onConfirm();
            }
        });

        dialog.present();
    }

    /**
     * Show a text input dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.heading - Dialog heading
     * @param {string} config.body - Dialog body text
     * @param {string} config.placeholder - Placeholder text
     * @param {string} config.defaultValue - Default input value
     * @param {Function} config.onSubmit - Callback with input value
     * @param {RegExp} config.validationPattern - Optional regex pattern for input validation
     * @param {string} config.validationMessage - Optional error message for invalid input
     */
    showTextInput(config) {
        const {
            heading,
            body,
            placeholder = '',
            defaultValue = '',
            onSubmit,
            validationPattern = null,
            validationMessage = 'Invalid input',
        } = config;

        const dialog = new Adw.Dialog({
            title: heading,
            content_width: 360,
            content_height: -1,
        });

        const toolbarView = new Adw.ToolbarView();
        const headerBar = new Adw.HeaderBar({show_title: true});
        toolbarView.add_top_bar(headerBar);

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 24,
            margin_end: 24,
            margin_top: 12,
            margin_bottom: 24,
        });

        // Body text
        const bodyLabel = new Gtk.Label({
            label: body,
            wrap: true,
            xalign: 0,
        });
        contentBox.append(bodyLabel);

        // Entry field
        const entry = new Gtk.Entry({
            placeholder_text: placeholder,
            text: defaultValue,
        });
        contentBox.append(entry);

        // Validation error label (hidden by default)
        const errorLabel = new Gtk.Label({
            label: validationMessage,
            css_classes: ['error', 'caption'],
            visible: false,
            xalign: 0,
        });
        contentBox.append(errorLabel);

        // Button box
        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            homogeneous: true,
            margin_top: 12,
        });

        const cancelButton = new Gtk.Button({label: 'Cancel'});
        const saveButton = new Gtk.Button({
            label: 'Save',
            css_classes: ['suggested-action'],
        });

        cancelButton.connect('clicked', () => {
            dialog.close();
        });

        saveButton.connect('clicked', () => {
            const value = entry.get_text().trim();

            // Validate if pattern is provided
            if (validationPattern && !validationPattern.test(value)) {
                errorLabel.set_visible(true);
                entry.add_css_class('error');
                return; // Don't close dialog, let user fix the input
            }

            dialog.close();
            if (onSubmit) {
                onSubmit(value);
            }
        });

        // Allow Enter key to submit
        entry.connect('activate', () => {
            saveButton.emit('clicked');
        });

        // Clear error styling when user starts typing
        entry.connect('changed', () => {
            errorLabel.set_visible(false);
            entry.remove_css_class('error');
        });

        buttonBox.append(cancelButton);
        buttonBox.append(saveButton);
        contentBox.append(buttonBox);

        toolbarView.set_content(contentBox);
        dialog.set_child(toolbarView);

        dialog.present(this.window);
    }

    /**
     * Show file picker dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.title - Dialog title
     * @param {Array<string>} config.mimeTypes - Accepted MIME types
     * @param {Function} config.onSelect - Callback with selected file path
     */
    showFilePicker(config) {
        const {title, mimeTypes = [], onSelect} = config;

        const dialog = new Gtk.FileDialog({title});

        if (mimeTypes.length > 0) {
            const filter = new Gtk.FileFilter();
            mimeTypes.forEach(type => filter.add_mime_type(type));
            filter.set_name('Supported Files');

            const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
            filterList.append(filter);
            dialog.set_filters(filterList);
        }

        dialog.open(this.window, null, (source, result) => {
            try {
                const file = dialog.open_finish(result);
                if (file && onSelect) {
                    onSelect(file.get_path());
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('File picker error:', e.message);
                }
            }
        });
    }

    /**
     * Show folder picker dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.title - Dialog title
     * @param {Function} config.onSelect - Callback with selected folder path
     */
    showFolderPicker(config) {
        const {title, onSelect} = config;

        const dialog = new Gtk.FileDialog({
            title,
            modal: true,
        });

        dialog.select_folder(this.window, null, (source, result) => {
            try {
                const folder = source.select_folder_finish(result);
                if (folder && onSelect) {
                    onSelect(folder.get_path());
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('Folder picker error:', e.message);
                }
            }
        });
    }

    /**
     * Show save file dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.title - Dialog title
     * @param {string} config.initialName - Initial file name
     * @param {Function} config.onSave - Callback with selected file path
     */
    showSaveDialog(config) {
        const {title, initialName = '', onSave} = config;

        const dialog = new Gtk.FileDialog({
            title,
            initial_name: initialName,
        });

        dialog.save(this.window, null, (source, result) => {
            try {
                const file = dialog.save_finish(result);
                if (file && onSave) {
                    onSave(file.get_path());
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    console.error('Save dialog error:', e.message);
                }
            }
        });
    }

    /**
     * Find toast overlay in widget hierarchy
     * @param {Gtk.Widget} widget - Starting widget
     * @returns {Adw.ToastOverlay|null} Toast overlay or null
     */
    static findToastOverlay(widget) {
        let current = widget;
        while (current) {
            if (current instanceof Adw.ToastOverlay) {
                return current;
            }
            if (current instanceof Adw.ApplicationWindow) {
                break;
            }
            current = current.get_parent();
        }
        return null;
    }

    /**
     * Show a toast notification
     * Delegates to ui-helpers.showToast for consistency
     * @param {Gtk.Widget} widget - Widget to find toast overlay from
     * @param {Object} config - Toast configuration
     * @param {string} config.title - Toast title
     * @param {number} config.timeout - Timeout in seconds (0 = no timeout)
     */
    static showToast(widget, config) {
        const {title, timeout = 2} = config;
        showToastHelper(widget, title, timeout);
    }

    showBlueprintsDialog(blueprintManager) {
        const dialog = new Adw.Dialog({
            title: 'Blueprints',
            content_width: 400,
            content_height: 500,
        });

        const toolbarView = new Adw.ToolbarView();

        const headerBar = new Adw.HeaderBar({
            show_title: true,
        });

        toolbarView.add_top_bar(headerBar);

        const blueprintBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });
        blueprintBox.append(blueprintManager.widget);

        toolbarView.set_content(blueprintBox);

        dialog.set_child(toolbarView);

        // Set dialog reference so BlueprintManager can close it
        blueprintManager.setDialog(dialog);

        dialog.present(this.window);
    }

    // Legacy methods - redirect to new unified methods
    showThemeNameDialog(callback) {
        this.showTextInput({
            heading: 'Export Omarchy Theme',
            body: 'Enter a name for your theme (lowercase letters and hyphens only)',
            placeholder: 'my-theme',
            validationPattern: /^[a-z]([a-z-]*[a-z])?$/,
            validationMessage:
                'Theme name must contain only lowercase letters (a-z) and hyphens (-)',
            onSubmit: value => callback(value || 'my-theme'),
        });
    }

    chooseExportDirectory(callback) {
        this.showFolderPicker({
            title: 'Choose Export Directory',
            onSelect: callback,
        });
    }

    showSuccessDialog(fullPath) {
        this.showMessage({
            heading: 'Theme Exported',
            body: `Theme exported successfully to:\n${fullPath}`,
        });
    }

    showErrorDialog(errorMessage) {
        this.showMessage({
            heading: 'Export Failed',
            body: `Failed to export theme: ${errorMessage}`,
        });
    }
}
