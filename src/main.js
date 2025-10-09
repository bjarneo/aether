#!/usr/bin/env gjs

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {PaletteGenerator} from './components/PaletteGenerator.js';
import {ColorSynthesizer} from './components/ColorSynthesizer.js';
import {BlueprintManager} from './components/BlueprintManager.js';
import {SettingsSidebar} from './components/SettingsSidebar.js';
import {ActionBar} from './components/ActionBar.js';
import {ConfigWriter} from './utils/ConfigWriter.js';
import {DialogManager} from './utils/DialogManager.js';
import {ThemeManager} from './services/theme-manager.js';
import {ThemeExporter} from './services/ThemeExporter.js';
import {BlueprintService} from './services/BlueprintService.js';

Adw.init();

// Initialize theme manager with live reload
const themeManager = new ThemeManager();
console.log(`Base theme: ${themeManager.getThemePath()}`);
console.log(
    `Override theme: ${themeManager.getOverridePath()} (edit this file)`
);

const AetherApplication = GObject.registerClass(
    class AetherApplication extends Adw.Application {
        _init() {
            super._init({
                application_id: 'com.aether.DesktopSynthesizer',
                flags: Gio.ApplicationFlags.FLAGS_NONE,
            });
            this.themeManager = themeManager;
        }

        vfunc_activate() {
            let window = this.active_window;
            if (!window) {
                window = new AetherWindow(this);
            }
            window.present();
        }

        vfunc_shutdown() {
            if (this.themeManager) {
                this.themeManager.destroy();
            }
            super.vfunc_shutdown();
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
            this.blueprintManager = new BlueprintManager();
            this.dialogManager = new DialogManager(this);
            this.blueprintService = new BlueprintService(this.blueprintManager);
            this.themeExporter = new ThemeExporter(
                this.configWriter,
                this.dialogManager
            );

            const mainContent = this._createMainContent();
            this.set_content(mainContent);
        }

        _createMainContent() {
            const contentPage = new Adw.NavigationPage({title: 'Synthesizer'});

            // Create main content with action bar
            const mainContent = new Adw.NavigationPage({title: 'Content'});

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

            mainContent.set_child(contentBox);

            // Create settings sidebar navigation page
            const settingsSidebarPage = new Adw.NavigationPage({
                title: 'Settings',
            });
            this.settingsSidebar = new SettingsSidebar();
            settingsSidebarPage.set_child(this.settingsSidebar.widget);

            // Use NavigationSplitView like blueprints sidebar
            this.settingsSplitView = new Adw.NavigationSplitView({
                sidebar_width_fraction: 0.3,
                max_sidebar_width: 350,
                show_content: true,
                collapsed: false,
            });

            this.settingsSplitView.set_content(mainContent);
            this.settingsSplitView.set_sidebar(settingsSidebarPage);

            contentPage.set_child(this.settingsSplitView);

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
                margin_bottom: 6,
            });

            this.paletteGenerator = new PaletteGenerator();
            paletteGroup.add(this.paletteGenerator.widget);

            this.colorSynthesizer = new ColorSynthesizer();

            mainBox.append(paletteGroup);

            return mainBox;
        }

        _createActionBar() {
            this.actionBar = new ActionBar();

            this.actionBar.connect('toggle-settings', (_, visible) => {
                this.settingsSplitView.collapsed = !visible;
            });

            this.actionBar.connect('show-blueprints', () => {
                this.dialogManager.showBlueprintsDialog(this.blueprintManager);
            });

            this.actionBar.connect('export-theme', () => {
                this._exportTheme();
            });

            this.actionBar.connect('save-blueprint', () => {
                this._saveBlueprint();
            });

            this.actionBar.connect('reset', () => {
                this._resetApplication();
            });

            this.actionBar.connect('apply-theme', () => {
                this._applyCurrentTheme();
            });

            return this.actionBar;
        }

        _connectSignals() {
            this.paletteGenerator.connect('palette-generated', (_, colors) => {
                this.colorSynthesizer.setPalette(colors);
                this._updateAccessibility();
            });

            this.colorSynthesizer.connect('color-changed', (_, role, color) => {
                this._updateAccessibility();
            });

            this.blueprintManager.connect(
                'blueprint-applied',
                (_, blueprint) => {
                    this._loadBlueprint(blueprint);
                }
            );

            // Connect settings sidebar signals
            this.settingsSidebar.connect('adjustments-changed', (_, values) => {
                this.paletteGenerator._applyAdjustments(values);
            });

            this.settingsSidebar.connect('adjustments-reset', () => {
                this.paletteGenerator._resetAdjustments();
            });

            this.settingsSidebar.connect('preset-applied', (_, preset) => {
                this.paletteGenerator.applyPreset(preset);
            });

            this.settingsSidebar.connect('gradient-generated', (_, colors) => {
                this.paletteGenerator.applyHarmony(colors);
            });

            this.settingsSidebar.connect(
                'light-mode-changed',
                (_, lightMode) => {
                    this.paletteGenerator.setLightMode(lightMode);
                }
            );
        }

        _updateAccessibility() {
            const colors = this.colorSynthesizer.getColors();
            this.settingsSidebar.updateAccessibility(colors);
        }

        _loadBlueprint(blueprint) {
            this.blueprintService.loadBlueprint(
                blueprint,
                this.paletteGenerator,
                this.colorSynthesizer,
                this.settingsSidebar
            );
            this._updateAccessibility();
        }

        _applyCurrentTheme() {
            try {
                const colors = this.colorSynthesizer.getColors();
                const palette = this.paletteGenerator.getPalette();
                const settings = this.settingsSidebar.getSettings();
                const lightMode = this.settingsSidebar.getLightMode();
                this.configWriter.applyTheme(
                    colors,
                    palette.wallpaper,
                    settings,
                    lightMode
                );
            } catch (e) {
                console.error(`Error applying theme: ${e.message}`);
            }
        }

        _resetApplication() {
            this.paletteGenerator.reset();
            this.colorSynthesizer.reset();
            this.settingsSidebar.resetAdjustments();
            this.settingsSidebar.setNeovimTheme(null); // Clear Neovim theme selection
            console.log('Application reset to launch state');
        }

        _saveBlueprint() {
            const palette = this.paletteGenerator.getPalette();
            const settings = this.settingsSidebar.getSettings();
            const lightMode = this.settingsSidebar.getLightMode();

            this.blueprintService.saveBlueprint(palette, settings, lightMode);
        }

        _exportTheme() {
            const colors = this.colorSynthesizer.getColors();
            const palette = this.paletteGenerator.getPalette();
            const settings = this.settingsSidebar.getSettings();
            const lightMode = this.settingsSidebar.getLightMode();

            this.themeExporter.setThemeData(
                colors,
                palette.wallpaper,
                settings,
                lightMode
            );
            this.themeExporter.startExport();
        }
    }
);

// Run the application
const app = new AetherApplication();
app.run([]);
