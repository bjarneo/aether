import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

/**
 * Centralized dialog management for consistent UI patterns
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
     */
    showTextInput(config) {
        const {
            heading,
            body,
            placeholder = '',
            defaultValue = '',
            onSubmit,
        } = config;

        const dialog = new Adw.MessageDialog({
            heading,
            body,
            transient_for: this.window,
        });

        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('save', 'Save');
        dialog.set_response_appearance(
            'save',
            Adw.ResponseAppearance.SUGGESTED
        );

        const entry = new Gtk.Entry({
            placeholder_text: placeholder,
            text: defaultValue,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
        });

        dialog.set_extra_child(entry);

        dialog.connect('response', (_, response) => {
            if (response === 'save' && onSubmit) {
                const value = entry.get_text().trim();
                onSubmit(value);
            }
        });

        dialog.present();
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
     * @param {Gtk.Widget} widget - Widget to find toast overlay from
     * @param {Object} config - Toast configuration
     * @param {string} config.title - Toast title
     * @param {number} config.timeout - Timeout in seconds (0 = no timeout)
     */
    static showToast(widget, config) {
        const {title, timeout = 2} = config;

        const overlay = DialogManager.findToastOverlay(widget);
        if (overlay) {
            const toast = new Adw.Toast({title, timeout});
            overlay.add_toast(toast);
        } else {
            console.log('Toast:', title);
        }
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
        dialog.present(this.window);
    }

    // Legacy methods - redirect to new unified methods
    showThemeNameDialog(callback) {
        this.showTextInput({
            heading: 'Export Theme',
            body: 'Enter a name for your theme',
            placeholder: 'my-theme',
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
