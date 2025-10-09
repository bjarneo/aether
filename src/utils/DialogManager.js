import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

export class DialogManager {
    constructor(window) {
        this.window = window;
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

    showThemeNameDialog(callback) {
        const nameDialog = new Adw.MessageDialog({
            heading: 'Export Theme',
            body: 'Enter a name for your theme',
            transient_for: this.window,
        });

        nameDialog.add_response('cancel', 'Cancel');
        nameDialog.add_response('continue', 'Continue');
        nameDialog.set_response_appearance(
            'continue',
            Adw.ResponseAppearance.SUGGESTED
        );

        const nameEntry = new Gtk.Entry({
            placeholder_text: 'my-theme',
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
        });

        nameDialog.set_extra_child(nameEntry);

        nameDialog.connect('response', (dialog, response) => {
            if (response === 'continue') {
                const themeName = nameEntry.get_text().trim() || 'my-theme';
                callback(themeName);
            }
        });

        nameDialog.present();
    }

    chooseExportDirectory(callback) {
        const fileDialog = new Gtk.FileDialog({
            title: 'Choose Export Directory',
            modal: true,
        });

        fileDialog.select_folder(this.window, null, (source, result) => {
            try {
                const folder = source.select_folder_finish(result);
                if (!folder) return;

                const exportPath = folder.get_path();
                callback(exportPath);
            } catch (e) {
                console.log('Export cancelled');
            }
        });
    }

    showSuccessDialog(fullPath) {
        const successDialog = new Adw.MessageDialog({
            heading: 'Theme Exported',
            body: `Theme exported successfully to:\n${fullPath}`,
            transient_for: this.window,
        });

        successDialog.add_response('ok', 'OK');
        successDialog.present();
    }

    showErrorDialog(errorMessage) {
        const errorDialog = new Adw.MessageDialog({
            heading: 'Export Failed',
            body: `Failed to export theme: ${errorMessage}`,
            transient_for: this.window,
        });

        errorDialog.add_response('ok', 'OK');
        errorDialog.present();
    }
}
