import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {ensureDirectoryExists, readFileAsText} from '../utils/file-utils.js';

/**
 * ThemeManager - Manages Aether's custom theming system with live reload
 *
 * Responsibilities:
 * - Creates and manages base theme CSS (~/.config/aether/theme.css)
 * - Handles theme override file (theme.override.css) for user customizations
 * - Monitors theme files for changes and reloads automatically
 * - Applies global sharp corners (border-radius: 0) for Hyprland aesthetic
 * - Symlink management for omarchy theme integration
 * - GTK named colors (@define-color) support
 *
 * Architecture:
 * - Base theme: Imports override file, applies to all Aether UI
 * - Override theme: User-editable or symlinked to omarchy theme
 * - File monitors: Automatic CSS reload on changes (Gio.FileMonitor)
 * - CSS providers: Separate providers for theme and sharp corners
 *
 * Theme File Flow:
 * 1. ~/.config/aether/theme.css (base, imports override)
 * 2. ~/.config/aether/theme.override.css (user overrides or symlink)
 * 3. ~/.config/omarchy/themes/aether/aether.override.css (generated from templates)
 *
 * Features:
 * - Live reload: Changes to CSS files apply instantly
 * - Symlink detection: Handles broken symlinks gracefully
 * - GTK integration: Uses GTK's @define-color for theming
 * - Sharp corners: Global border-radius override
 * - Omarchy integration: Monitors omarchy theme directory
 *
 * @class ThemeManager
 */
export class ThemeManager {
    /**
     * Initializes ThemeManager with file monitoring and theme application
     * Creates base theme if missing, sets up file monitors, applies CSS
     * @constructor
     */
    constructor(ohmydebnMode = false) {
        this.cssProvider = null;
        this.sharpCornersCssProvider = null;
        this._ohmydebnCssProvider = null;
        this._ohmydebnThemeMonitor = null;
        this.fileMonitor = null;
        this.overrideFileMonitor = null;
        this.omarchyThemeMonitor = null;
        this.themeFile = null;
        this.overrideFile = null;
        this._ohmydebnMode = ohmydebnMode;

        this._initializeThemeFiles();

        if (this._ohmydebnMode) {
            // In OhMyDebn mode, try to use the system GTK theme
            const settings = Gtk.Settings.get_default();

            // Get the theme from dconf
            let themeName = null;
            try {
                const [ok, stdout] = GLib.spawn_command_line_sync(
                    'dconf read /org/gnome/desktop/interface/gtk-theme'
                );
                if (ok) {
                    themeName = new TextDecoder().decode(stdout).trim();
                    themeName = themeName.replace(/^'|'$/g, '');
                }
            } catch (e) {
                // Use system default if dconf fails
            }

            console.log(`OhMyDebn theme: ${themeName}`);

            // Try to load GTK4 theme from ~/.themes/ (where OhMyDebn generates cinnamon themes)
            if (themeName) {
                const userThemePath = GLib.build_filenamev([
                    GLib.get_home_dir(),
                    '.themes',
                    themeName,
                    'gtk-4.0',
                    'gtk.css',
                ]);

                if (GLib.file_test(userThemePath, GLib.FileTest.EXISTS)) {
                    try {
                        const provider = new Gtk.CssProvider();
                        provider.load_from_path(userThemePath);
                        Gtk.StyleContext.add_provider_for_display(
                            Gdk.Display.get_default(),
                            provider,
                            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
                        );
                        this._ohmydebnCssProvider = provider;
                        console.log(`Loaded GTK4 theme from: ${userThemePath}`);
                    } catch (e) {
                        console.error(`Failed to load theme: ${e.message}`);
                    }
                } else {
                    console.log(`Theme not found at: ${userThemePath}`);
                }

                // Set up file monitor for theme changes
                this._setupOhMyDebnThemeMonitor(userThemePath);
            }
        } else {
            // Normal (non-OhMyDebn) mode: apply Aether's custom theme with sharp corners
            this._applyGlobalSharpCorners();
            this._applyTheme();
        }

        this._setupFileMonitors();
    }

    /**
     * Reload the OhMyDebn GTK4 theme (called when a theme is applied)
     * @public
     */
    reloadOhMyDebnTheme() {
        if (!this._ohmydebnMode) return;

        // Add a small delay to allow theme regeneration to complete
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._doReloadOhMyDebnTheme();
            return GLib.SOURCE_REMOVE;
        });
    }

    _doReloadOhMyDebnTheme() {
        // Get the current theme from dconf
        let themeName = null;
        try {
            const [ok, stdout] = GLib.spawn_command_line_sync(
                'dconf read /org/gnome/desktop/interface/gtk-theme'
            );
            if (ok) {
                themeName = new TextDecoder().decode(stdout).trim();
                themeName = themeName.replace(/^'|'$/g, '');
            }
        } catch (e) {
            return;
        }

        if (!themeName) return;

        console.log(`Reloading OhMyDebn theme: ${themeName}`);

        // Remove old provider if exists
        if (this._ohmydebnCssProvider) {
            try {
                Gtk.StyleContext.remove_provider_for_display(
                    Gdk.Display.get_default(),
                    this._ohmydebnCssProvider
                );
            } catch (e) {
                // Provider may already be removed
            }
        }

        // Load GTK4 theme from ~/.themes/
        const userThemePath = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.themes',
            themeName,
            'gtk-4.0',
            'gtk.css',
        ]);

        if (GLib.file_test(userThemePath, GLib.FileTest.EXISTS)) {
            try {
                // Always create a new provider for each reload
                const provider = new Gtk.CssProvider();
                provider.load_from_path(userThemePath);

                // Use THEME priority which is higher than APPLICATION
                Gtk.StyleContext.add_provider_for_display(
                    Gdk.Display.get_default(),
                    provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_THEME
                );

                // Keep track of the new provider
                this._ohmydebnCssProvider = provider;
                console.log(`Reloaded GTK4 theme from: ${userThemePath}`);

                // Update file monitor for new theme
                this._setupOhMyDebnThemeMonitor(userThemePath);
            } catch (e) {
                console.error(`Failed to reload theme: ${e.message}`);
            }
        }
    }

    _setupOhMyDebnThemeMonitor(themeCssPath) {
        // Remove old monitor if exists
        if (this._ohmydebnThemeMonitor) {
            this._ohmydebnThemeMonitor.cancel();
        }

        try {
            const themeFile = Gio.File.new_for_path(themeCssPath);
            this._ohmydebnThemeMonitor = themeFile.monitor_file(
                Gio.FileMonitorFlags.NONE,
                null
            );

            this._ohmydebnThemeMonitor.connect(
                'changed',
                (monitor, file, otherFile, eventType) => {
                    if (
                        eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                        eventType === Gio.FileMonitorEvent.CHANGED
                    ) {
                        console.log(
                            'OhMyDebn theme file changed, reloading...'
                        );
                        this._doReloadOhMyDebnTheme();
                    }
                }
            );

            console.log('File monitor setup for OhMyDebn theme');
        } catch (e) {
            console.error(`Failed to setup theme monitor: ${e.message}`);
        }
    }

    _applyOhMyDebnColors(themeName) {
        if (!themeName) return;

        // Look for colors.toml in ohmydebn-themes directories
        const themePaths = [
            `/usr/share/ohmydebn-themes/${themeName}/colors.toml`,
            `${GLib.get_home_dir()}/.local/share/ohmydebn/themes/${themeName}/colors.toml`,
        ];

        let colorsTomlPath = null;
        for (const path of themePaths) {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                colorsTomlPath = path;
                break;
            }
        }

        if (!colorsTomlPath) {
            console.log(`Could not find colors.toml for theme: ${themeName}`);
            return;
        }

        try {
            const content = readFileAsText(colorsTomlPath);
            const colors = this._parseColorsToml(content);

            // Build CSS with @define-color
            const css = this._buildOhMyDebnCss(colors);
            this._applyOhMyDebnCss(css, colorsTomlPath);
        } catch (e) {
            console.error(`Error applying OhMyDebn colors: ${e.message}`);
        }
    }

    _parseColorsToml(content) {
        const colors = {};
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^(\w+)\s*=\s*"([^"]+)"$/);
                if (match) {
                    colors[match[1]] = match[2];
                }
            }
        }
        return colors;
    }

    _buildOhMyDebnCss(colors) {
        let css = '/* OhMyDebn colors */\n';

        // First define the colors as variables
        css += `@define-color window_bg_color ${colors.background || '#000000'};\n`;
        css += `@define-color window_fg_color ${colors.foreground || '#ffffff'};\n`;
        css += `@define-color accent_bg_color ${colors.accent || '#000000'};\n`;
        css += `@define-color accent_fg_color ${colors.background || '#000000'};\n`;
        css += `@define-color view_bg_color ${colors.background || '#000000'};\n`;
        css += `@define-color view_fg_color ${colors.foreground || '#ffffff'};\n`;
        css += `@define-color headerbar_bg_color ${colors.background || '#000000'};\n`;
        css += `@define-color headerbar_fg_color ${colors.foreground || '#ffffff'};\n`;
        css += `@define-color card_bg_color ${colors.color0 || '#000000'};\n`;
        css += `@define-color card_fg_color ${colors.foreground || '#ffffff'};\n`;

        // Add color palette
        for (let i = 0; i <= 15; i++) {
            const color = colors[`color${i}`];
            if (color) {
                css += `@define-color color${i} ${color};\n`;
            }
        }

        // Also add direct CSS overrides to ensure they take effect
        css += `
window, .window {
    background-color: ${colors.background || '#000000'};
    color: ${colors.foreground || '#ffffff'};
}
.view, .content {
    background-color: ${colors.background || '#000000'};
    color: ${colors.foreground || '#ffffff'};
}
headerbar, .headerbar {
    background-color: ${colors.background || '#000000'};
    color: ${colors.foreground || '#ffffff'};
}
button, .button {
    background-color: ${colors.color0 || '#000000'};
}
button.suggested-action, .suggested-action {
    background-color: ${colors.accent || '#000000'};
    color: ${colors.background || '#ffffff'};
}
`;

        return css;
    }

    _applyOhMyDebnCss(css, sourcePath) {
        try {
            const provider = new Gtk.CssProvider();
            provider.load_from_string(css);

            // Apply to display with high priority
            Gtk.StyleContext.add_provider_for_display(
                Gdk.Display.get_default(),
                provider,
                800
            );

            console.log(`Applied OhMyDebn colors from: ${sourcePath}`);
        } catch (e) {
            console.error(`Error applying OhMyDebn CSS: ${e.message}`);
        }
    }

    _initializeThemeFiles() {
        const configDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
        ]);
        ensureDirectoryExists(configDir);

        const themePath = GLib.build_filenamev([configDir, 'theme.css']);
        const overridePath = GLib.build_filenamev([
            configDir,
            'theme.override.css',
        ]);

        this.themeFile = Gio.File.new_for_path(themePath);
        this.overrideFile = Gio.File.new_for_path(overridePath);

        // Create base theme if it doesn't exist
        if (!this.themeFile.query_exists(null)) {
            this._createBaseTheme();
        }

        // Handle override file - check if it's a broken symlink
        this._handleOverrideFile();
    }

    _handleOverrideFile() {
        try {
            const fileInfo = this.overrideFile.query_info(
                'standard::is-symlink,standard::symlink-target',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            );

            if (fileInfo.get_is_symlink()) {
                const symlinkTarget = fileInfo.get_symlink_target();

                // Check if symlink points to omarchy theme
                if (symlinkTarget?.includes('/omarchy/themes/')) {
                    const currentThemeOverride =
                        this._getCurrentThemeOverridePath();

                    if (currentThemeOverride) {
                        const currentOverrideFile =
                            Gio.File.new_for_path(currentThemeOverride);

                        if (!currentOverrideFile.query_exists(null)) {
                            this._clearToDefaultTheme();
                            return;
                        }
                        return;
                    }
                }

                // Check if symlink target exists
                if (!Gio.File.new_for_path(symlinkTarget).query_exists(null)) {
                    this._clearToDefaultTheme();
                    return;
                }
            }
        } catch (e) {
            // File doesn't exist or can't be queried
            if (!this.overrideFile.query_exists(null)) {
                this._createOverrideTheme();
            }
        }
    }

    _getCurrentThemeOverridePath() {
        try {
            const currentThemeLink = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'omarchy',
                'current',
                'theme',
            ]);

            const currentThemeFile = Gio.File.new_for_path(currentThemeLink);

            if (!currentThemeFile.query_exists(null)) {
                return null;
            }

            const fileInfo = currentThemeFile.query_info(
                'standard::is-symlink,standard::symlink-target',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            );

            if (fileInfo.get_is_symlink()) {
                const targetPath = fileInfo.get_symlink_target();
                return GLib.build_filenamev([
                    targetPath,
                    'aether.override.css',
                ]);
            }
        } catch (e) {
            console.error(`Failed to get current theme path: ${e.message}`);
        }

        return null;
    }

    _clearToDefaultTheme() {
        try {
            if (this.overrideFile.query_exists(null)) {
                this.overrideFile.delete(null);
            }
            this._createOverrideTheme();
            console.log('Cleared to default theme');
        } catch (e) {
            console.error(`Failed to clear to default theme: ${e.message}`);
        }
    }

    _createBaseTheme() {
        const baseTheme = `/* Aether Base Theme
 * DO NOT EDIT THIS FILE - Your changes will be preserved in theme.override.css
 * 
 * This file simply loads your custom theme overrides.
 * To customize the theme, edit theme.override.css instead.
 * 
 * You can override GTK named colors directly:
 * @define-color accent_bg_color #7aa2f7;
 * @define-color window_bg_color #1e1e2e;
 */

@define-color accent_bg_color #7aa2f7;
/* Load user overrides */
@import url('theme.override.css');
`;

        try {
            this.themeFile.replace_contents(
                new TextEncoder().encode(baseTheme),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            console.log(`Created base theme at: ${this.themeFile.get_path()}`);
        } catch (e) {
            console.error(`Failed to create base theme: ${e.message}`);
        }
    }

    _applyGlobalSharpCorners() {
        const css = `
        /* Remove all rounded corners for sharp Hyprland aesthetic */
        * {
            border-radius: 0px;
        }

        .card {
            border-radius: 0px;
        }

        button {
            border-radius: 0px;
        }

        .boxed-list {
            border-radius: 0px;
        }

        .boxed-list > row {
            border-radius: 0px;
        }

        entry {
            border-radius: 0px;
        }

        .toolbar {
            border-radius: 0px;
        }

        headerbar {
            border-radius: 0px;
        }

        popover {
            border-radius: 0px;
        }

        dialog {
            border-radius: 0px;
        }

        menu {
            border-radius: 0px;
        }

        menubutton {
            border-radius: 0px;
        }

        .background {
            border-radius: 0px;
        }
    `;

        try {
            this.sharpCornersCssProvider = new Gtk.CssProvider();
            this.sharpCornersCssProvider.load_from_string(css);
            Gtk.StyleContext.add_provider_for_display(
                Gdk.Display.get_default(),
                this.sharpCornersCssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
            console.log('Sharp corners CSS applied');
        } catch (e) {
            console.error(`Failed to apply sharp corners CSS: ${e.message}`);
        }
    }

    _createOverrideTheme() {
        const overrideTheme = `/* Aether Theme Overrides
 * Edit this file to customize your Aether theme
 * Changes are applied automatically on save (live reload)
 * 
 * Override GTK named colors directly to theme the entire application.
 * These colors are used throughout the GTK/Libadwaita interface.
 * 
 * AVAILABLE GTK NAMED COLORS:
 * 
 * ACCENT COLORS (interactive elements, suggested buttons):
 *   @define-color accent_bg_color #color;      Main accent color
 *   @define-color accent_fg_color #color;      Accent foreground/text
 *   @define-color accent_color #color;         Accent color variant
 * 
 * WINDOW/VIEW COLORS:
 *   @define-color window_bg_color #color;      Main window background
 *   @define-color window_fg_color #color;      Main window foreground/text
 *   @define-color view_bg_color #color;        Content area background
 *   @define-color view_fg_color #color;        Content area text
 * 
 * UI ELEMENT COLORS:
 *   @define-color headerbar_bg_color #color;   Header bar background
 *   @define-color headerbar_fg_color #color;   Header bar text
 *   @define-color card_bg_color #color;        Card/panel background
 *   @define-color card_fg_color #color;        Card/panel text
 *   @define-color borders #color;              Border colors
 * 
 * ACTION COLORS:
 *   @define-color destructive_bg_color #color; Delete/remove button background
 *   @define-color destructive_fg_color #color; Delete/remove button text
 *   @define-color success_bg_color #color;     Success state background
 *   @define-color success_fg_color #color;     Success state text
 *   @define-color warning_bg_color #color;     Warning state background
 *   @define-color warning_fg_color #color;     Warning state text
 *   @define-color error_bg_color #color;       Error state background
 *   @define-color error_fg_color #color;       Error state text
 * 
 * EXAMPLE - Tokyo Night Theme:
 * 
 * @define-color accent_bg_color #7aa2f7;
 * @define-color accent_fg_color #1a1b26;
 * @define-color accent_color #7aa2f7;
 * 
 * @define-color window_bg_color #1a1b26;
 * @define-color window_fg_color #c0caf5;
 * @define-color view_bg_color #16161e;
 * @define-color view_fg_color #c0caf5;
 * 
 * @define-color headerbar_bg_color #1a1b26;
 * @define-color headerbar_fg_color #c0caf5;
 * @define-color card_bg_color #24283b;
 * @define-color card_fg_color #c0caf5;
 * 
 * @define-color destructive_bg_color #f7768e;
 * @define-color destructive_fg_color #1a1b26;
 * 
 * @define-color borders rgba(255, 255, 255, 0.1);
 * 
 * See examples/ directory for more theme examples.
 * See THEMING.md for detailed documentation.
 */

/* Add your color overrides here */
`;

        try {
            this.overrideFile.replace_contents(
                new TextEncoder().encode(overrideTheme),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            console.log(
                `Created override theme at: ${this.overrideFile.get_path()}`
            );
        } catch (e) {
            console.error(`Failed to create override theme: ${e.message}`);
        }
    }

    _applyTheme() {
        if (this._ohmydebnMode) return;

        try {
            // Remove old provider if exists
            if (this.cssProvider) {
                Gtk.StyleContext.remove_provider_for_display(
                    Gdk.Display.get_default(),
                    this.cssProvider
                );
            }

            // Create new provider
            this.cssProvider = new Gtk.CssProvider();
            this.cssProvider.load_from_file(this.themeFile);

            // Add to display
            Gtk.StyleContext.add_provider_for_display(
                Gdk.Display.get_default(),
                this.cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_USER
            );

            console.log('Theme applied successfully');
        } catch (e) {
            console.error(`Failed to apply theme: ${e.message}`);
        }
    }

    _reloadTheme() {
        if (this._ohmydebnMode) return;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._applyTheme();
            return GLib.SOURCE_REMOVE;
        });
    }

    _revalidateAndReloadTheme() {
        if (this._ohmydebnMode) return;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._handleOverrideFile();
            this._applyTheme();
            return GLib.SOURCE_REMOVE;
        });
    }

    _setupFileMonitors() {
        // Monitor base theme file
        try {
            this.fileMonitor = this.themeFile.monitor_file(
                Gio.FileMonitorFlags.NONE,
                null
            );

            this.fileMonitor.connect(
                'changed',
                (monitor, file, otherFile, eventType) => {
                    if (
                        eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                        eventType === Gio.FileMonitorEvent.CHANGED
                    ) {
                        console.log('Base theme file changed, reloading...');
                        this._reloadTheme();
                    }
                }
            );

            console.log('File monitor setup for base theme');
        } catch (e) {
            console.error(`Failed to setup base theme monitor: ${e.message}`);
        }

        // Monitor override file
        try {
            this.overrideFileMonitor = this.overrideFile.monitor_file(
                Gio.FileMonitorFlags.NONE,
                null
            );

            this.overrideFileMonitor.connect(
                'changed',
                (monitor, file, otherFile, eventType) => {
                    if (
                        eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                        eventType === Gio.FileMonitorEvent.CHANGED
                    ) {
                        console.log(
                            'Override theme file changed, reloading...'
                        );
                        this._reloadTheme();
                    } else if (eventType === Gio.FileMonitorEvent.DELETED) {
                        console.log(
                            'Override theme file deleted, clearing to default...'
                        );
                        this._revalidateAndReloadTheme();
                    }
                }
            );

            console.log(
                'File monitor setup for override theme (live reload enabled)'
            );
        } catch (e) {
            console.error(
                `Failed to setup override theme monitor: ${e.message}`
            );
        }

        // Monitor omarchy current theme symlink
        this._setupOmarchyThemeMonitor();
    }

    _setupOmarchyThemeMonitor() {
        try {
            const omarchyCurrentTheme = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'omarchy',
                'current',
                'theme',
            ]);

            const omarchyThemeFile = Gio.File.new_for_path(omarchyCurrentTheme);

            // Only set up monitor if omarchy directory exists
            if (!omarchyThemeFile.query_exists(null)) {
                console.log(
                    'Omarchy current theme not found, skipping monitor'
                );
                return;
            }

            this.omarchyThemeMonitor = omarchyThemeFile.monitor_file(
                Gio.FileMonitorFlags.NONE,
                null
            );

            this.omarchyThemeMonitor.connect(
                'changed',
                (monitor, file, otherFile, eventType) => {
                    if (
                        eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                        eventType === Gio.FileMonitorEvent.CHANGED ||
                        eventType === Gio.FileMonitorEvent.DELETED ||
                        eventType === Gio.FileMonitorEvent.CREATED
                    ) {
                        console.log(
                            'Omarchy current theme changed, validating override...'
                        );
                        this._revalidateAndReloadTheme();
                    }
                }
            );

            console.log('File monitor setup for omarchy current theme');
        } catch (e) {
            console.error(
                `Failed to setup omarchy theme monitor: ${e.message}`
            );
        }
    }

    getThemePath() {
        return this.themeFile.get_path();
    }

    getOverridePath() {
        return this.overrideFile.get_path();
    }

    destroy() {
        if (this.fileMonitor) {
            this.fileMonitor.cancel();
            this.fileMonitor = null;
        }

        if (this.overrideFileMonitor) {
            this.overrideFileMonitor.cancel();
            this.overrideFileMonitor = null;
        }

        if (this.omarchyThemeMonitor) {
            this.omarchyThemeMonitor.cancel();
            this.omarchyThemeMonitor = null;
        }

        if (this.cssProvider) {
            Gtk.StyleContext.remove_provider_for_display(
                Gdk.Display.get_default(),
                this.cssProvider
            );
            this.cssProvider = null;
        }

        if (this.sharpCornersCssProvider) {
            Gtk.StyleContext.remove_provider_for_display(
                Gdk.Display.get_default(),
                this.sharpCornersCssProvider
            );
            this.sharpCornersCssProvider = null;
        }
    }
}
