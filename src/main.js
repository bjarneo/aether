#!/usr/bin/env gjs

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import { PaletteGenerator } from './components/PaletteGenerator.js';
import { ColorSynthesizer } from './components/ColorSynthesizer.js';
import { BlueprintManager } from './components/BlueprintManager.js';
import { ConfigWriter } from './utils/ConfigWriter.js';

Adw.init();

const AetherApplication = GObject.registerClass(
    class AetherApplication extends Adw.Application {
        _init() {
            super._init({
                application_id: 'com.aether.DesktopSynthesizer',
                flags: Gio.ApplicationFlags.FLAGS_NONE,
            });
        }

        vfunc_activate() {
            let window = this.active_window;
            if (!window) {
                window = new AetherWindow(this);
            }
            window.present();
        }
    }
);

const AetherWindow = GObject.registerClass(
    class AetherWindow extends Adw.ApplicationWindow {
        _init(application) {
            super._init({
                application,
                title: 'Aether',
                default_width: 900,
                default_height: 700,
            });

            this.configWriter = new ConfigWriter();
            this._initializeUI();
            this._connectSignals();
        }

        _initializeUI() {
            const splitView = this._createSplitView();
            this.set_content(splitView);
        }

        _createSplitView() {
            const splitView = new Adw.NavigationSplitView({
                sidebar_width_fraction: 0.35,
                max_sidebar_width: 350,
            });

            splitView.set_sidebar(this._createSidebar());
            splitView.set_content(this._createMainContent());

            return splitView;
        }

        _createSidebar() {
            const sidebarPage = new Adw.NavigationPage({ title: 'Blueprints' });

            this.blueprintManager = new BlueprintManager();
            sidebarPage.set_child(this.blueprintManager.widget);

            return sidebarPage;
        }

        _createMainContent() {
            const contentPage = new Adw.NavigationPage({ title: 'Synthesizer' });

            const scrolledWindow = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const clamp = new Adw.Clamp({
                maximum_size: 800,
                tightening_threshold: 600,
            });

            const mainBox = this._createMainContentBox();
            clamp.set_child(mainBox);
            scrolledWindow.set_child(clamp);

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
            });
            contentBox.append(scrolledWindow);
            contentBox.append(this._createActionBar());

            contentPage.set_child(contentBox);

            return contentPage;
        }

        _createMainContentBox() {
            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            const paletteGroup = new Adw.PreferencesGroup({
                title: 'Generative Palette',
                description: 'Extract colors from your wallpaper',
                margin_bottom: 6,
            });

            this.paletteGenerator = new PaletteGenerator();
            paletteGroup.add(this.paletteGenerator.widget);

            this.colorSynthesizer = new ColorSynthesizer();

            mainBox.append(paletteGroup);

            return mainBox;
        }

        _createActionBar() {
            const actionBar = new Gtk.ActionBar({
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            const exportButton = new Gtk.Button({ label: 'Export Theme' });
            exportButton.connect('clicked', () => this._exportTheme());
            actionBar.pack_start(exportButton);

            const saveButton = new Gtk.Button({ label: 'Save Blueprint' });
            saveButton.connect('clicked', () => this._saveBlueprint());
            actionBar.pack_end(saveButton);

            const applyButton = new Gtk.Button({
                label: 'Apply Theme',
                css_classes: ['suggested-action'],
            });
            applyButton.connect('clicked', () => this._applyCurrentTheme());
            actionBar.pack_end(applyButton);

            return actionBar;
        }

        _connectSignals() {
            this.paletteGenerator.connect('palette-generated', (_, colors) => {
                this.colorSynthesizer.setPalette(colors);
            });

            this.colorSynthesizer.connect('color-changed', (_, role, color) => {
                // Colors changed - user can click "Apply Theme" when ready
            });

            this.blueprintManager.connect('blueprint-applied', (_, blueprint) => {
                this._loadBlueprint(blueprint);
            });
        }

        _loadBlueprint(blueprint) {
            try {
                console.log('Loading blueprint:', blueprint.name);

                // Reset adjustment sliders when loading a blueprint
                this.paletteGenerator.resetAdjustments();

                if (blueprint.palette?.wallpaper) {
                    this.paletteGenerator.loadWallpaper(blueprint.palette.wallpaper);
                }

                if (blueprint.palette?.colors) {
                    this.paletteGenerator.setPalette(blueprint.palette.colors);
                    this.colorSynthesizer.setPalette(blueprint.palette.colors);
                }

                if (blueprint.colors) {
                    this.colorSynthesizer.loadColors(blueprint.colors);
                }
            } catch (e) {
                console.error(`Error loading blueprint: ${e.message}`);
            }
        }

        _applyCurrentTheme() {
            try {
                const colors = this.colorSynthesizer.getColors();
                const palette = this.paletteGenerator.getPalette();
                this.configWriter.applyTheme(colors, palette.wallpaper);
            } catch (e) {
                console.error(`Error applying theme: ${e.message}`);
            }
        }

        _saveBlueprint() {
            const blueprint = {
                palette: this.paletteGenerator.getPalette(),
                colors: this.colorSynthesizer.getColors(),
                timestamp: Date.now(),
            };

            this.blueprintManager.saveBlueprint(blueprint);
        }

        _exportTheme() {
            this._showThemeNameDialog();
        }

        _showThemeNameDialog() {
            const nameDialog = new Adw.MessageDialog({
                heading: 'Export Theme',
                body: 'Enter a name for your theme',
                transient_for: this,
            });

            nameDialog.add_response('cancel', 'Cancel');
            nameDialog.add_response('continue', 'Continue');
            nameDialog.set_response_appearance('continue', Adw.ResponseAppearance.SUGGESTED);

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
                    this._chooseExportDirectory(themeName);
                }
            });

            nameDialog.present();
        }

        _chooseExportDirectory(themeName) {
            const fileDialog = new Gtk.FileDialog({
                title: 'Choose Export Directory',
                modal: true,
            });

            fileDialog.select_folder(this, null, (source, result) => {
                try {
                    const folder = source.select_folder_finish(result);
                    if (!folder) return;

                    const exportPath = folder.get_path();
                    this._performExport(themeName, exportPath);
                } catch (e) {
                    console.log('Export cancelled');
                }
            });
        }

        _performExport(themeName, exportPath) {
            try {
                const colors = this.colorSynthesizer.getColors();
                const palette = this.paletteGenerator.getPalette();
                const themeDir = `omarchy-${themeName}-theme`;
                const fullPath = GLib.build_filenamev([exportPath, themeDir]);

                console.log(`Exporting theme to: ${fullPath}`);

                this.configWriter.exportTheme(colors, palette.wallpaper, fullPath, themeName);

                this._showSuccessDialog(fullPath);
            } catch (e) {
                this._showErrorDialog(e.message);
            }
        }

        _showSuccessDialog(fullPath) {
            const successDialog = new Adw.MessageDialog({
                heading: 'Theme Exported',
                body: `Theme exported successfully to:\n${fullPath}`,
                transient_for: this,
            });

            successDialog.add_response('ok', 'OK');
            successDialog.present();
        }

        _showErrorDialog(errorMessage) {
            const errorDialog = new Adw.MessageDialog({
                heading: 'Export Failed',
                body: `Failed to export theme: ${errorMessage}`,
                transient_for: this,
            });

            errorDialog.add_response('ok', 'OK');
            errorDialog.present();
        }
    }
);

// Run the application
const app = new AetherApplication();
app.run([]);
