/**
 * AetherWindow - Main application window for Aether
 *
 * Primary window with split view layout containing:
 * - PaletteEditor: Wallpaper selection and color extraction
 * - ColorSynthesizer: Color role assignments
 * - SettingsSidebar: Theme customization and template settings
 * - BlueprintsView: Theme save/load functionality
 * - WallpaperBrowser: Wallhaven integration
 * - LocalWallpaperBrowser: Local wallpaper browsing
 * - FavoritesView: Favorite wallpapers
 * - SchedulerView: Theme scheduling
 *
 * State Management:
 * Components share state through ThemeState (src/state/ThemeState.js).
 * AetherWindow connects component signals for UI coordination only.
 *
 * @module AetherWindow
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {applyCssToWidget} from './utils/ui-helpers.js';
import {ThemeEditor} from './components/ThemeEditor.js';
import {ColorSynthesizer} from './components/ColorSynthesizer.js';
import {BlueprintsView} from './components/BlueprintsView.js';
import {SettingsSidebar} from './components/SettingsSidebar.js';
import {ThemeActionBar} from './components/ThemeActionBar.js';
import {WallpaperEditor} from './components/WallpaperEditor.js';
import {WallpaperBrowser} from './components/WallpaperBrowser.js';
import {LocalWallpaperBrowser} from './components/LocalWallpaperBrowser.js';
import {FavoritesView} from './components/FavoritesView.js';
import {SchedulerView} from './components/SchedulerView.js';
import {ConfigWriter} from './utils/ConfigWriter.js';
import {DialogManager} from './utils/DialogManager.js';
import {ThemeExporter} from './services/ThemeExporter.js';
import {themeState} from './state/ThemeState.js';

/**
 * AetherWindow - Main application window
 * @class
 * @extends {Adw.ApplicationWindow}
 */
export const AetherWindow = GObject.registerClass(
    class AetherWindow extends Adw.ApplicationWindow {
        /**
         * Initialize window with application reference
         * @param {Adw.Application} application - Parent application
         */
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
            this._connectThemeState();
        }

        /**
         * Connect to centralized theme state for cross-component coordination
         * @private
         */
        _connectThemeState() {
            // Only listen to color-roles-changed since it's always emitted after palette-changed.
            // This prevents duplicate updates when setPalette() is called (which emits both signals).
            themeState.connect('color-roles-changed', () => {
                this._updateAccessibility();
                this._updateAppOverrideColors();
            });
        }

        /**
         * Initialize all UI components
         * @private
         */
        _initializeUI() {
            this.dialogManager = new DialogManager(this);

            this.themeExporter = new ThemeExporter(
                this.configWriter,
                this.dialogManager
            );

            // Create header bar first (contains ViewSwitcher)
            this._createHeaderBar();

            // Create main content (will connect to ViewSwitcher)
            const mainContent = this._createMainContent();

            // Wrap content in ToolbarView with header bar
            const toolbarView = new Adw.ToolbarView();

            // Add subtle bottom border to header bar with sharp styling
            applyCssToWidget(
                this.headerBar,
                `
                headerbar {
                    border-bottom: 1px solid alpha(@borders, 0.5);
                }
            `
            );

            toolbarView.add_top_bar(this.headerBar);
            toolbarView.set_content(mainContent);

            // Wrap in ToastOverlay for notifications
            this.toastOverlay = new Adw.ToastOverlay();
            this.toastOverlay.set_child(toolbarView);

            this.set_content(this.toastOverlay);

            // Apply initial settings state (after UI is created)
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                const settings = this.settingsSidebar.getSettings();

                // Set initial neovim theme selection state
                const neovimThemeSelected =
                    settings.selectedNeovimConfig !== null;
                this.paletteGenerator.setNeovimThemeSelected(
                    neovimThemeSelected
                );

                return GLib.SOURCE_REMOVE;
            });
        }

        /**
         * Create header bar with view switcher and menu
         * @private
         */
        _createHeaderBar() {
            this.headerBar = new Adw.HeaderBar({
                show_title: false,
            });

            // View switcher on the left with menu-like styling
            this._viewSwitcher = new Adw.ViewSwitcher({
                policy: Adw.ViewSwitcherPolicy.WIDE,
                css_classes: ['linked'],
            });

            // Sharp corners on view switcher buttons
            applyCssToWidget(
                this._viewSwitcher,
                `
                viewswitcher button {
                    border-radius: 0;
                }
            `
            );

            this.headerBar.pack_start(this._viewSwitcher);

            // Menu button on the right
            const menuButton = new Gtk.MenuButton({
                icon_name: 'open-menu-symbolic',
                tooltip_text: 'Main Menu',
            });

            // Sharp menu button
            applyCssToWidget(
                menuButton,
                `
                menubutton button {
                    border-radius: 0;
                }
            `
            );

            menuButton.set_menu_model(this._createMenuModel());
            this.headerBar.pack_end(menuButton);
        }

        /**
         * Create main menu model
         * @private
         * @returns {Gio.Menu} Menu model
         */
        _createMenuModel() {
            const menu = new Gio.Menu();

            // About section
            const aboutSection = new Gio.Menu();
            aboutSection.append('About Aether', 'app.about');
            menu.append_section(null, aboutSection);

            return menu;
        }

        /**
         * Create main content with view stack
         * @private
         * @returns {Adw.NavigationPage} Main content page
         */
        _createMainContent() {
            // Create main ViewStack for tab navigation
            this._viewStack = new Adw.ViewStack();

            // Editor page
            const editorPage = this._createEditorPage();
            this._viewStack.add_titled_with_icon(
                editorPage,
                'editor',
                'Editor',
                'applications-graphics-symbolic'
            );

            // Wallhaven browser page
            this._wallhavenBrowser = new WallpaperBrowser();
            this._wallhavenBrowser.connect(
                'wallpaper-selected',
                (_, path, metadata) => {
                    this._onBrowserWallpaperSelected(path, metadata);
                }
            );
            this._wallhavenBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._wallhavenBrowser.connect(
                'add-to-additional-images',
                (_, wallpaper) => {
                    this.paletteGenerator.addWallhavenImage(wallpaper);
                }
            );
            this._viewStack.add_titled_with_icon(
                this._wallhavenBrowser,
                'wallhaven',
                'Wallhaven',
                'web-browser-symbolic'
            );

            // Local wallpapers page
            this._localBrowser = new LocalWallpaperBrowser();
            this._localBrowser.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._localBrowser.connect('favorites-changed', () => {
                if (this._favoritesView) {
                    this._favoritesView.loadFavorites();
                }
            });
            this._viewStack.add_titled_with_icon(
                this._localBrowser,
                'local',
                'Local',
                'folder-pictures-symbolic'
            );

            // Favorites page
            this._favoritesView = new FavoritesView();
            this._favoritesView.connect('wallpaper-selected', (_, path) => {
                this._onBrowserWallpaperSelected(path);
            });
            this._viewStack.add_titled_with_icon(
                this._favoritesView,
                'favorites',
                'Favorites',
                'emblem-favorite-symbolic'
            );

            // Blueprints page
            this._blueprintsView = new BlueprintsView();
            this._blueprintsView.connect(
                'blueprint-applied',
                (_, blueprint) => {
                    this._loadBlueprint(blueprint);
                    // Switch back to editor after applying
                    this._viewStack.set_visible_child_name('editor');
                }
            );
            this._blueprintsView.connect('save-requested', () => {
                this._saveBlueprint();
            });
            this._blueprintsView.connect('theme-imported', (_, theme) => {
                this._importOmarchyTheme(theme);
            });
            this._blueprintsView.connect('theme-applied', (_, theme) => {
                const toast = new Adw.Toast({
                    title: `Applied theme: ${theme.name}`,
                    timeout: 3,
                });
                this.toastOverlay.add_toast(toast);
            });

            this._viewStack.add_titled_with_icon(
                this._blueprintsView,
                'blueprints',
                'Themes',
                'color-select-symbolic'
            );

            // Scheduler page
            this._schedulerView = new SchedulerView();
            this._viewStack.add_titled_with_icon(
                this._schedulerView,
                'scheduler',
                'Scheduler',
                'alarm-symbolic'
            );

            // Refresh scheduler when switching to it
            this._viewStack.connect('notify::visible-child-name', () => {
                if (this._viewStack.get_visible_child_name() === 'scheduler') {
                    this._schedulerView.refresh();
                }
            });

            // Connect view switcher to view stack
            this._viewSwitcher.set_stack(this._viewStack);

            // Wrap viewstack in navigation page
            this.contentPage = new Adw.NavigationPage({title: 'Aether'});
            this.contentPage.set_child(this._viewStack);

            return this.contentPage;
        }

        /**
         * Handle wallpaper selection from any browser
         * @private
         * @param {string} path - Wallpaper path
         * @param {Object} [metadata] - Optional wallpaper metadata
         */
        _onBrowserWallpaperSelected(path, metadata = null) {
            // Switch to editor tab
            this._viewStack.set_visible_child_name('editor');

            // Reset adjustments and app overrides when changing wallpaper
            this.settingsSidebar.resetAdjustments();
            themeState.resetAppOverrides();

            // Load the wallpaper into centralized state (components react via signals)
            themeState.setWallpaper(path, metadata);
        }

        /**
         * Create editor page with stack for main view and wallpaper editor
         * @private
         * @returns {Gtk.Stack} Editor stack
         */
        _createEditorPage() {
            // Create a stack for editor content (main view vs wallpaper editor)
            this._editorStack = new Gtk.Stack({
                transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
                transition_duration: 200,
            });

            // Main editor view
            const mainContentView = this._createMainContentView();
            this._editorStack.add_named(mainContentView, 'main');

            return this._editorStack;
        }

        /**
         * Create main content view with settings sidebar
         * @private
         * @returns {Adw.NavigationSplitView} Split view with content and sidebar
         */
        _createMainContentView() {
            // Create main content with action bar
            const mainContent = new Adw.NavigationPage({title: 'Content'});

            // Main box contains the theme editor (with its own scrolling) and action bar
            const mainBox = this._createMainContentBox();

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
            });
            contentBox.append(mainBox);
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

        /**
         * Create main content box with theme editor
         * @private
         * @returns {Gtk.Box} Main content box
         */
        _createMainContentBox() {
            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            // Use the redesigned ThemeEditor
            this.paletteGenerator = new ThemeEditor();
            this.paletteGenerator.set_vexpand(true);

            this.colorSynthesizer = new ColorSynthesizer();

            mainBox.append(this.paletteGenerator);

            return mainBox;
        }

        /**
         * Create action bar with buttons
         * @private
         * @returns {ThemeActionBar} Action bar widget
         */
        _createActionBar() {
            this.actionBar = new ThemeActionBar();

            this.actionBar.connect('toggle-settings', (_, visible) => {
                this.settingsSplitView.collapsed = !visible;
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

            this.actionBar.connect('import-base16', () => {
                this.paletteGenerator._importBase16();
            });

            this.actionBar.connect('import-colors-toml', () => {
                this.paletteGenerator._importColorsToml();
            });

            return this.actionBar;
        }

        /**
         * Connect all component signals
         * UI coordination signals - state is managed by ThemeState
         * @private
         */
        _connectSignals() {
            // Palette generation triggers UI updates (already handled by themeState signals)
            this.paletteGenerator.connect('palette-generated', (_, colors) => {
                this.settingsSidebar.resetAdjustments();
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

            this.paletteGenerator.connect('browse-wallhaven', () => {
                this._viewStack.set_visible_child_name('wallhaven');
            });

            this.paletteGenerator.connect('browse-local', () => {
                this._viewStack.set_visible_child_name('local');
            });

            // Connect settings sidebar signals
            this.settingsSidebar.connect('adjustments-changed', (_, values) => {
                this.paletteGenerator.applyAdjustments(values);
            });

            this.settingsSidebar.connect('adjustments-reset', () => {
                this.paletteGenerator.resetAdjustments();
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
                    themeState.setLightMode(lightMode);
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
                'neovim-theme-changed',
                (_, selected) => {
                    const settings = this.settingsSidebar.getSettings();
                    themeState.setNeovimTheme(settings.selectedNeovimConfig);
                    this.paletteGenerator.setNeovimThemeSelected(selected);
                }
            );
        }

        /**
         * Update accessibility checker with current colors
         * @private
         */
        _updateAccessibility() {
            const colorRoles = themeState.getColorRoles();
            this.settingsSidebar.updateAccessibility(colorRoles);
        }

        /**
         * Update app override colors
         * @private
         */
        _updateAppOverrideColors() {
            const colorRoles = themeState.getColorRoles();
            this.paletteGenerator.updateAppOverrideColors(colorRoles);
        }

        /**
         * Load a blueprint into the editor
         * Blueprint is already loaded into themeState by BlueprintsView.
         * This handles additional UI coordination.
         * Adjustments and app overrides are restored via themeState signals.
         * @param {Object} blueprint - Blueprint data
         * @private
         */
        _loadBlueprint(blueprint) {
            try {
                console.log('Loading blueprint:', blueprint.name);

                // Switch to custom tab for blueprint editing
                this.paletteGenerator.switchToCustomTab();

                // Load settings (including Neovim theme selection)
                if (blueprint.settings?.selectedNeovimConfig !== undefined) {
                    this.settingsSidebar.setNeovimTheme(
                        blueprint.settings.selectedNeovimConfig
                    );
                }
            } catch (e) {
                console.error(`Error loading blueprint: ${e.message}`);
            }

            this._updateAccessibility();
        }

        /**
         * Import an Omarchy theme into the editor
         * Loads the theme's colors and first background into the palette editor
         * @param {Object} theme - Omarchy theme data
         * @private
         */
        _importOmarchyTheme(theme) {
            try {
                console.log('Importing Omarchy theme:', theme.name);

                // Reset adjustments for fresh start
                this.settingsSidebar.resetAdjustments();
                themeState.resetAppOverrides();

                // Load colors into ThemeState
                if (theme.colors && theme.colors.length === 16) {
                    themeState.setPalette(theme.colors, {resetExtended: true});
                }

                // Load extended colors if available
                if (theme.extendedColors && Object.keys(theme.extendedColors).length > 0) {
                    themeState.setExtendedColors(theme.extendedColors);
                }

                // Use the first background image from the theme
                if (theme.wallpapers && theme.wallpapers.length > 0) {
                    themeState.setWallpaper(theme.wallpapers[0]);
                }

                // Switch to editor tab first
                this._viewStack.set_visible_child_name('editor');

                // Switch to custom tab for palette editing
                this.paletteGenerator.switchToCustomTab();

                // Show toast
                const toast = new Adw.Toast({
                    title: `Imported theme: ${theme.name}`,
                    timeout: 3,
                });
                this.toastOverlay.add_toast(toast);
            } catch (e) {
                console.error(`Error importing Omarchy theme: ${e.message}`);
            }

            this._updateAccessibility();
        }

        /**
         * Apply current theme configuration
         * @private
         */
        _applyCurrentTheme() {
            try {
                // Get state from centralized store
                const colorRoles = themeState.getColorRoles();
                const wallpaperPath = themeState.getWallpaper();
                const lightMode = themeState.getLightMode();
                const appOverrides = themeState.getAppOverrides();
                const additionalImages = themeState.getAdditionalImages();
                // Settings still from component (not in themeState)
                const settings = this.settingsSidebar.getSettings();

                const result = this.configWriter.applyTheme({
                    colorRoles,
                    wallpaperPath,
                    settings,
                    lightMode,
                    appOverrides,
                    additionalImages,
                });

                if (result.success) {
                    const message = result.isOmarchy
                        ? 'Theme applied successfully'
                        : `Theme created at ${result.themePath}`;
                    const toast = new Adw.Toast({title: message, timeout: 3});
                    this.toastOverlay.add_toast(toast);
                }
            } catch (e) {
                console.error(`Error applying theme: ${e.message}`);
            }
        }

        /**
         * Reset application to initial state
         * @private
         */
        _resetApplication() {
            // Reset centralized state - components react via signals
            themeState.reset();
            // Also reset component-specific UI state
            this.settingsSidebar.resetAdjustments();
            this.settingsSidebar.setNeovimTheme(null);
            console.log('Application reset to launch state');
        }

        /**
         * Show clear theme confirmation dialog
         * @private
         */
        _clearTheme() {
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

        /**
         * Save current state as blueprint
         * @private
         */
        _saveBlueprint() {
            // Get blueprint from centralized state
            const blueprint = themeState.toBlueprint();
            // Add settings (not in themeState)
            blueprint.settings = this.settingsSidebar.getSettings();

            // Switch to blueprints tab and save
            this._viewStack.set_visible_child_name('blueprints');
            this._blueprintsView.saveBlueprint(blueprint);
        }

        /**
         * Apply only the wallpaper
         * @private
         */
        _applyWallpaper() {
            try {
                const wallpaperPath = themeState.getWallpaper();
                if (wallpaperPath) {
                    this.configWriter.applyWallpaper(wallpaperPath);
                }
            } catch (e) {
                console.error(`Error applying wallpaper: ${e.message}`);
            }
        }

        /**
         * Export theme to file
         * @private
         */
        _exportTheme() {
            // Get state from centralized store
            const colorRoles = themeState.getColorRoles();
            const wallpaperPath = themeState.getWallpaper();
            const lightMode = themeState.getLightMode();
            const appOverrides = themeState.getAppOverrides();
            // Settings still from component
            const settings = this.settingsSidebar.getSettings();

            this.themeExporter.setThemeData(
                colorRoles,
                wallpaperPath,
                settings,
                lightMode,
                appOverrides
            );
            this.themeExporter.startExport();
        }

        /**
         * Load wallpaper from CLI argument
         * @param {string} wallpaperPath - Path to wallpaper
         */
        loadWallpaperFromCLI(wallpaperPath) {
            // Set in centralized state, components react via signals
            themeState.setWallpaper(wallpaperPath);
        }

        /**
         * Show wallpaper editor for given wallpaper
         * @private
         * @param {string} wallpaperPath - Path to wallpaper
         */
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

                this._editorStack.add_named(
                    this._wallpaperEditor,
                    'wallpaper-editor'
                );
            } else {
                // Reset editor with new wallpaper and clear all filters
                this._wallpaperEditor.resetEditor(wallpaperPath);
            }

            // Switch to wallpaper editor view
            this._editorStack.set_visible_child_name('wallpaper-editor');
        }

        /**
         * Hide wallpaper editor and return to main view
         * @private
         */
        _hideWallpaperEditor() {
            this._editorStack.set_visible_child_name('main');
        }

        /**
         * Show blueprints tab
         * @private
         */
        _showBlueprintsTab() {
            this._viewStack.set_visible_child_name('blueprints');
            this._blueprintsView.loadBlueprints();
        }
    }
);
