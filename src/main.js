#!/usr/bin/env gjs

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {PaletteGenerator} from './components/PaletteGenerator.js';
import {ColorSynthesizer} from './components/ColorSynthesizer.js';
import {BlueprintManager} from './components/BlueprintManager.js';
import {BlueprintManagerWindow} from './components/BlueprintManagerWindow.js';
import {SettingsSidebar} from './components/SettingsSidebar.js';
import {ActionBar} from './components/ActionBar.js';
import {WallpaperEditor} from './components/WallpaperEditor.js';
import {AboutDialog} from './components/AboutDialog.js';
import {ConfigWriter} from './utils/ConfigWriter.js';
import {DialogManager} from './utils/DialogManager.js';
import {ThemeManager} from './services/theme-manager.js';
import {ThemeExporter} from './services/ThemeExporter.js';
import {BlueprintService} from './services/BlueprintService.js';
import {ensureDirectoryExists} from './utils/file-utils.js';

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
                application_id: 'li.oever.aether',
                flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
            });
            this.themeManager = themeManager;
            this._wallpaperPath = null;

            // Ensure ~/Wallpapers directory exists
            const wallpapersDir = GLib.build_filenamev([
                GLib.get_home_dir(),
                'Wallpapers',
            ]);
            ensureDirectoryExists(wallpapersDir);

            // Install shaders on startup
            this._installShaders();

            this.add_main_option(
                'wallpaper',
                'w'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Path to wallpaper image to load on startup',
                'FILE'
            );
        }

        vfunc_command_line(commandLine) {
            const options = commandLine.get_options_dict();

            if (options.contains('wallpaper')) {
                const wallpaperPath = options
                    .lookup_value('wallpaper', GLib.VariantType.new('s'))
                    .get_string()[0];

                // Validate that the file exists
                const file = Gio.File.new_for_path(wallpaperPath);
                if (file.query_exists(null)) {
                    this._wallpaperPath = wallpaperPath;
                } else {
                    printerr(
                        `Error: Wallpaper file not found: ${wallpaperPath}`
                    );
                }
            }

            this.activate();
            return 0;
        }

        vfunc_activate() {
            let window = this.active_window;
            if (!window) {
                window = new AetherWindow(this);

                // Set up application actions
                this._setupActions(window);

                // Load wallpaper if provided via CLI
                if (this._wallpaperPath) {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        window.loadWallpaperFromCLI(this._wallpaperPath);
                        this._wallpaperPath = null;
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
            window.present();
        }

        _installShaders() {
            try {
                // Get shader source directory (in Aether repo)
                const appDir = GLib.path_get_dirname(
                    GLib.path_get_dirname(
                        Gio.File.new_for_path(
                            import.meta.url.replace('file://', '')
                        ).get_path()
                    )
                );
                const shaderSource = GLib.build_filenamev([appDir, 'shaders']);

                // Get shader target directory (hyprshade location)
                const shaderTarget = GLib.build_filenamev([
                    GLib.get_user_config_dir(),
                    'hypr',
                    'shaders',
                ]);

                // Ensure target directory exists
                ensureDirectoryExists(shaderTarget);

                // Check if source directory exists
                const sourceDir = Gio.File.new_for_path(shaderSource);
                if (!sourceDir.query_exists(null)) {
                    console.log('Shader source directory not found, skipping installation');
                    return;
                }

                // Get all shader files
                const enumerator = sourceDir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                let installedCount = 0;
                while ((info = enumerator.next_file(null)) !== null) {
                    const name = info.get_name();
                    if (name.endsWith('.glsl')) {
                        const sourcePath = GLib.build_filenamev([shaderSource, name]);
                        const targetPath = GLib.build_filenamev([shaderTarget, name]);

                        // Only create symlink if it doesn't exist
                        const targetFile = Gio.File.new_for_path(targetPath);
                        if (!targetFile.query_exists(null)) {
                            // Create symlink: targetFile.make_symbolic_link(sourcePath)
                            // This creates a symlink AT targetPath that POINTS TO sourcePath
                            targetFile.make_symbolic_link(sourcePath, null);
                            installedCount++;
                        }
                    }
                }

                console.log(`Installed ${installedCount} Aether shaders to ${shaderTarget}`);
            } catch (error) {
                console.error('Error installing shaders:', error);
            }
        }

        _setupActions(window) {
            // About action
            const aboutAction = new Gio.SimpleAction({name: 'about'});
            aboutAction.connect('activate', () => {
                AboutDialog.show(window);
            });
            this.add_action(aboutAction);
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

            // Blueprint service will use the window version for saving
            // We'll initialize it after creating the blueprint window
            this.blueprintService = null;

            this.themeExporter = new ThemeExporter(
                this.configWriter,
                this.dialogManager
            );

            const mainContent = this._createMainContent();

            // Wrap content in ToolbarView with header bar
            const toolbarView = new Adw.ToolbarView();
            this._createHeaderBar();
            toolbarView.add_top_bar(this.headerBar);
            toolbarView.set_content(mainContent);

            this.set_content(toolbarView);

            // Apply initial settings state (after UI is created)
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                const settings = this.settingsSidebar.getSettings();
                this.paletteGenerator.setAppOverridesVisible(
                    settings.enableAppOverrides || false
                );

                // Set initial neovim theme selection state
                const neovimThemeSelected =
                    settings.selectedNeovimConfig !== null;
                this.paletteGenerator._appOverridesWidget.setNeovimThemeSelected(
                    neovimThemeSelected
                );

                return GLib.SOURCE_REMOVE;
            });
        }

        _createHeaderBar() {
            this.headerBar = new Adw.HeaderBar();

            // Menu button on the right
            const menuButton = new Gtk.MenuButton({
                icon_name: 'open-menu-symbolic',
                tooltip_text: 'Main Menu',
            });
            menuButton.set_menu_model(this._createMenuModel());
            this.headerBar.pack_end(menuButton);
        }

        _createMenuModel() {
            const menu = new Gio.Menu();

            // About section
            const aboutSection = new Gio.Menu();
            aboutSection.append('About Aether', 'app.about');
            menu.append_section(null, aboutSection);

            return menu;
        }

        _createMainContent() {
            this.contentPage = new Adw.NavigationPage({title: 'Synthesizer'});

            // Create a stack to switch between main content and wallpaper editor
            this.contentStack = new Gtk.Stack({
                transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
                transition_duration: 200,
            });

            // Main content view
            const mainContentView = this._createMainContentView();
            this.contentStack.add_named(mainContentView, 'main');

            // Wallpaper editor will be added dynamically when needed

            this.contentPage.set_child(this.contentStack);

            return this.contentPage;
        }

        _createMainContentView() {
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

            return this.settingsSplitView;
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
                this._showBlueprintManager();
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

            this.actionBar.connect('clear', () => {
                this._clearTheme();
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
                this._updateAppOverrideColors();
            });

            this.paletteGenerator.connect(
                'open-wallpaper-editor',
                (_, wallpaperPath) => {
                    this._showWallpaperEditor(wallpaperPath);
                }
            );

            this.paletteGenerator.connect('apply-wallpaper', () => {
                this._applyWallpaper();
            });

            this.colorSynthesizer.connect('color-changed', (_, role, color) => {
                this._updateAccessibility();
                this._updateAppOverrideColors();
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

            this.settingsSidebar.connect('settings-changed', () => {
                this.settingsSidebar.saveSettings();
            });

            this.settingsSidebar.connect(
                'palette-from-color-generated',
                (_, colors) => {
                    this.paletteGenerator.applyHarmony(colors);
                }
            );

            this.settingsSidebar.connect(
                'app-overrides-enabled-changed',
                (_, enabled) => {
                    this.paletteGenerator.setAppOverridesVisible(enabled);
                }
            );

            this.settingsSidebar.connect(
                'neovim-theme-changed',
                (_, selected) => {
                    this.paletteGenerator._appOverridesWidget.setNeovimThemeSelected(
                        selected
                    );
                }
            );
        }

        _updateAccessibility() {
            const colors = this.colorSynthesizer.getColors();
            this.settingsSidebar.updateAccessibility(colors);
        }

        _updateAppOverrideColors() {
            const colors = this.colorSynthesizer.getColors();
            this.paletteGenerator._appOverridesWidget.setPaletteColors(colors);
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
                const appOverrides = this.paletteGenerator.getAppOverrides();
                const additionalImages = this.paletteGenerator.getAdditionalImages();
                this.configWriter.applyTheme(
                    colors,
                    palette.wallpaper,
                    settings,
                    lightMode,
                    appOverrides,
                    additionalImages
                );
            } catch (e) {
                console.error(`Error applying theme: ${e.message}`);
            }
        }

        _resetApplication() {
            this.paletteGenerator.reset();
            this.paletteGenerator.resetAppOverrides(); // Reset per-application color overrides
            this.colorSynthesizer.reset();
            this.settingsSidebar.resetAdjustments();
            this.settingsSidebar.setNeovimTheme(null); // Clear Neovim theme selection
            console.log('Application reset to launch state');
        }

        _clearTheme() {
            // Create confirmation dialog
            const dialog = new Adw.MessageDialog({
                transient_for: this,
                modal: true,
                heading: 'Clear Theme?',
                body: 'This will remove GTK theme files and switch to tokyo-night theme. This action cannot be undone.',
            });

            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('clear', 'Clear Theme');
            dialog.set_response_appearance(
                'clear',
                Adw.ResponseAppearance.DESTRUCTIVE
            );
            dialog.set_default_response('cancel');
            dialog.set_close_response('cancel');

            dialog.connect('response', (_, response) => {
                if (response === 'clear') {
                    try {
                        this.configWriter.clearTheme();
                        console.log('Theme cleared successfully');
                    } catch (e) {
                        console.error(`Error clearing theme: ${e.message}`);
                    }
                }
            });

            dialog.present();
        }

        _saveBlueprint() {
            const palette = this.paletteGenerator.getPalette();
            const settings = this.settingsSidebar.getSettings();
            const lightMode = this.settingsSidebar.getLightMode();

            // Initialize blueprint service if not already initialized
            if (!this.blueprintService) {
                // Show blueprint manager first to initialize the service
                this._showBlueprintManager();
            }

            this.blueprintService.saveBlueprint(palette, settings, lightMode);
        }

        _applyWallpaper() {
            try {
                const palette = this.paletteGenerator.getPalette();
                this.configWriter.applyWallpaper(palette.wallpaper);
            } catch (e) {
                console.error(`Error applying wallpaper: ${e.message}`);
            }
        }

        _exportTheme() {
            const colors = this.colorSynthesizer.getColors();
            const palette = this.paletteGenerator.getPalette();
            const settings = this.settingsSidebar.getSettings();
            const lightMode = this.settingsSidebar.getLightMode();
            const appOverrides = this.paletteGenerator.getAppOverrides();

            this.themeExporter.setThemeData(
                colors,
                palette.wallpaper,
                settings,
                lightMode,
                appOverrides
            );
            this.themeExporter.startExport();
        }

        loadWallpaperFromCLI(wallpaperPath) {
            this.paletteGenerator.loadWallpaper(wallpaperPath);
        }

        _showWallpaperEditor(wallpaperPath) {
            // Create wallpaper editor if it doesn't exist
            if (!this._wallpaperEditor) {
                this._wallpaperEditor = new WallpaperEditor(wallpaperPath);

                // Handle wallpaper applied - go back to main view
                this._wallpaperEditor.connect(
                    'wallpaper-applied',
                    (_, processedPath) => {
                        this._hideWallpaperEditor();
                        // Small delay to ensure file is fully written
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                            this.paletteGenerator.loadWallpaper(processedPath);
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                );

                this.contentStack.add_named(this._wallpaperEditor, 'editor');
            } else {
                // Reset editor with new wallpaper and clear all filters
                this._wallpaperEditor.resetEditor(wallpaperPath);
            }

            // Switch to editor view
            this.contentStack.set_visible_child_name('editor');
        }

        _hideWallpaperEditor() {
            // Switch back to main view
            this.contentStack.set_visible_child_name('main');
        }

        _showBlueprintManager() {
            // Create blueprint manager window if it doesn't exist
            if (!this._blueprintManagerWindow) {
                this._blueprintManagerWindow = new BlueprintManagerWindow();

                // Initialize blueprint service with the window
                if (!this.blueprintService) {
                    this.blueprintService = new BlueprintService(
                        this._blueprintManagerWindow
                    );
                }

                // Handle blueprint applied
                this._blueprintManagerWindow.connect(
                    'blueprint-applied',
                    (_, blueprint) => {
                        this._loadBlueprint(blueprint);
                    }
                );

                // Handle close requested
                this._blueprintManagerWindow.connect('close-requested', () => {
                    this._hideBlueprintManager();
                });

                this.contentStack.add_named(
                    this._blueprintManagerWindow,
                    'blueprints'
                );
            } else {
                // Reload blueprints when showing the window
                this._blueprintManagerWindow.loadBlueprints();
            }

            // Update header title
            this.contentPage.set_title('Blueprints');

            // Switch to blueprint manager view
            this.contentStack.set_visible_child_name('blueprints');
        }

        _hideBlueprintManager() {
            // Switch back to main view
            this.contentStack.set_visible_child_name('main');
        }
    }
);

// Run the application
const app = new AetherApplication();
app.run([imports.system.programInvocationName].concat(ARGV));
