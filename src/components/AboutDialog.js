import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import {SPACING} from '../constants/ui-constants.js';

export class AboutDialog {
    static show(parent) {
        // Get the icon path (src/icons/aether.png)
        const componentsDir = GLib.path_get_dirname(
            import.meta.url.replace('file://', '')
        );
        const srcDir = GLib.path_get_dirname(componentsDir);
        const iconPath = GLib.build_filenamev([srcDir, 'icons', 'aether.png']);

        // Create custom dialog window
        const dialog = new Adw.Window({
            modal: true,
            transient_for: parent,
            default_width: 400,
            default_height: 500,
            title: 'About Aether',
        });

        // Create toolbar view
        const toolbarView = new Adw.ToolbarView();

        // Header bar with close button
        const headerBar = new Adw.HeaderBar({
            show_end_title_buttons: true,
            show_start_title_buttons: false,
        });
        toolbarView.add_top_bar(headerBar);

        // Content
        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });

        const clamp = new Adw.Clamp({
            maximum_size: 400,
        });

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 24,
            margin_top: 36,
            margin_bottom: 36,
            margin_start: 24,
            margin_end: 24,
            halign: Gtk.Align.CENTER,
        });

        // Logo
        const logo = new Gtk.Picture({
            file: Gio.File.new_for_path(iconPath),
            width_request: 128,
            height_request: 128,
            halign: Gtk.Align.CENTER,
        });
        contentBox.append(logo);

        // App name
        const appName = new Gtk.Label({
            label: 'Aether',
            css_classes: ['title-1'],
            halign: Gtk.Align.CENTER,
        });
        contentBox.append(appName);

        // Buttons box
        const buttonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: SPACING.MD,
            halign: Gtk.Align.FILL,
            margin_top: SPACING.MD,
        });

        // Report Issue button
        const issueButton = new Gtk.Button({
            label: 'Report an Issue',
            halign: Gtk.Align.FILL,
        });
        issueButton.connect('clicked', () => {
            Gtk.show_uri(parent, 'https://github.com/bjarneo/aether/issues', 0);
        });
        buttonsBox.append(issueButton);

        // X.com button
        const xButton = new Gtk.Button({
            label: 'Follow on X',
            halign: Gtk.Align.FILL,
        });
        xButton.connect('clicked', () => {
            Gtk.show_uri(parent, 'https://x.com/iamdothash', 0);
        });
        buttonsBox.append(xButton);

        contentBox.append(buttonsBox);

        clamp.set_child(contentBox);
        scrolled.set_child(clamp);
        toolbarView.set_content(scrolled);
        dialog.set_content(toolbarView);

        dialog.present();
    }
}
