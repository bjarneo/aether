import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    readFileAsText,
    writeTextToFile,
    copyFile,
    ensureDirectoryExists,
    cleanDirectory,
    enumerateDirectory,
    createSymlink,
    deleteFile,
    fileExists,
} from './file-utils.js';
import {getTemplateMap, resolveTemplatePath} from './template-utils.js';
import {loadJsonFile} from './file-utils.js';
import {hexToRgbString, hexToRgba, hexToYaruTheme} from './color-utils.js';
import {restartSwaybg, isOmarchyInstalled} from './service-manager.js';
import {DEFAULT_COLORS} from '../constants/colors.js';
import {getAppNameFromFileName} from '../constants/templates.js';
import {GtkThemeApplier} from './theme-appliers/GtkThemeApplier.js';
import {VscodeThemeApplier} from './theme-appliers/VscodeThemeApplier.js';
import {VencordThemeApplier} from './theme-appliers/VencordThemeApplier.js';
import {ZedThemeApplier} from './theme-appliers/ZedThemeApplier.js';

/**
 * ConfigWriter - Processes theme templates and applies themes to various applications
 *
 * Responsibilities:
 * - Process template files with color variable substitution
 * - Copy wallpapers and additional images to theme directory
 * - Generate config files for multiple applications (Hyprland, Kitty, Waybar, etc.)
 * - Handle special cases (GTK, Vencord, Zed, VSCode, Neovim)
 * - Apply themes using omarchy theme manager
 * - Manage light/dark mode indicators
 *
 * Template Variable Format:
 * - {background}, {foreground} - Primary colors
 * - {black}, {red}, {green}, {yellow}, {blue}, {magenta}, {cyan}, {white} - Normal ANSI colors
 * - {bright_black}, {bright_red}, etc. - Bright ANSI colors
 * - {color.strip} - Hex color without # prefix
 * - {color.rgb} - Decimal RGB format (e.g., 255,0,255)
 * - {color.rgba:0.5} - RGBA format with alpha
 * - {wallpaper} - Path to wallpaper file
 *
 * File Paths:
 * - Templates: {projectDir}/templates/
 * - Output: ~/.config/aether/theme/
 * - Wallpapers: ~/.config/aether/theme/backgrounds/
 * - Omarchy symlink: ~/.config/omarchy/themes/aether/ → ~/.config/aether/theme/
 *
 * @class ConfigWriter
 */
export class ConfigWriter {
    /**
     * Initializes ConfigWriter with directory paths
     * @constructor
     */
    constructor() {
        this.configDir = GLib.get_user_config_dir();
        this.projectDir = GLib.path_get_dirname(
            GLib.path_get_dirname(
                GLib.path_get_dirname(
                    Gio.File.new_for_path(
                        import.meta.url.replace('file://', '')
                    ).get_path()
                )
            )
        );
        this.templatesDir = GLib.build_filenamev([
            this.projectDir,
            'templates',
        ]);
        // Theme files stored in ~/.config/aether/theme/
        this.themeDir = GLib.build_filenamev([
            this.configDir,
            'aether',
            'theme',
        ]);
        // Symlink target for omarchy compatibility
        this.omarchyThemeDir = GLib.build_filenamev([
            this.configDir,
            'omarchy',
            'themes',
            'aether',
        ]);
        this.wallpaperPath = null;

        // Initialize theme appliers
        this.gtkApplier = new GtkThemeApplier();
        this.vscodeApplier = new VscodeThemeApplier(this.templatesDir);
        this.vencordApplier = new VencordThemeApplier(this.themeDir);
        this.zedApplier = new ZedThemeApplier(this.themeDir);
    }

    /**
     * Applies theme with color roles and wallpaper
     * Main entry point for theme application
     *
     * @param {Object} colorRoles - Color role assignments (background, foreground, black, red, etc.)
     * @param {string} wallpaperPath - Path to wallpaper file
     * @param {Object} [settings={}] - Theme settings
     * @param {boolean} [settings.includeGtk] - Apply GTK theming
     * @param {boolean} [settings.includeVencord] - Apply Vencord (Discord) theme
     * @param {boolean} [settings.includeZed] - Apply Zed editor theme
     * @param {boolean} [settings.includeVscode] - Apply VSCode theme
     * @param {boolean} [lightMode=false] - Light mode flag
     * @param {Object} [appOverrides={}] - Per-application template overrides
     * @param {Array<string>} [additionalImages=[]] - Additional images to copy
     * @param {boolean} [sync=false] - Use synchronous theme application
     * @returns {{success: boolean, isOmarchy: boolean, themePath: string}} Result object
     */
    applyTheme(
        colorRoles,
        wallpaperPath,
        settings = {},
        lightMode = false,
        appOverrides = {},
        additionalImages = [],
        sync = false
    ) {
        const isOmarchy = isOmarchyInstalled();

        try {
            this._createThemeDirectory();

            if (wallpaperPath) {
                this._copyWallpaper(wallpaperPath);
            }

            // Copy additional images
            if (additionalImages && additionalImages.length > 0) {
                this._copyAdditionalImages(additionalImages);
            }

            const variables = this._buildVariables(colorRoles, lightMode);
            this._processTemplates(variables, settings, appOverrides);
            this._applyAetherThemeOverride(variables);

            // Only apply GTK theming if enabled
            if (settings.includeGtk === true) {
                const gtkSourcePath = GLib.build_filenamev([
                    this.themeDir,
                    'gtk.css',
                ]);
                this.gtkApplier.apply(gtkSourcePath);
            }

            // Copy Vencord theme to all existing installations if enabled
            if (settings.includeVencord === true) {
                this.vencordApplier.apply();
            }

            // Copy Zed theme if enabled
            if (settings.includeZed === true) {
                this.zedApplier.apply();
            }

            // Copy VSCode theme if enabled
            if (settings.includeVscode === true) {
                this.vscodeApplier.apply(variables);
            }

            this._handleLightModeMarker(this.themeDir, lightMode);
            this._processAppTemplates(variables, appOverrides);
            this._processSymlinks();

            // Only apply omarchy theme if omarchy is installed
            if (isOmarchy) {
                this._applyOmarchyTheme(sync);
            }

            return {success: true, isOmarchy, themePath: this.themeDir};
        } catch (e) {
            console.error('Error applying theme:', e.message);
            return {success: false, isOmarchy, themePath: this.themeDir};
        }
    }

    /**
     * Creates theme directory, cleans backgrounds directory, and creates omarchy symlink
     * @private
     */
    _createThemeDirectory() {
        ensureDirectoryExists(this.themeDir);

        const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);
        ensureDirectoryExists(bgDir);
        cleanDirectory(bgDir);

        // Create symlink from omarchy themes dir to aether theme dir
        this._createOmarchySymlink();
    }

    /**
     * Creates symlink from ~/.config/omarchy/themes/aether -> ~/.config/aether/theme
     * If the omarchy path exists as a regular directory (not symlink), it will be deleted first
     * @private
     */
    _createOmarchySymlink() {
        try {
            const omarchyThemesParent = GLib.path_get_dirname(this.omarchyThemeDir);
            ensureDirectoryExists(omarchyThemesParent);

            // Remove existing directory if it's not a symlink
            const omarchyFile = Gio.File.new_for_path(this.omarchyThemeDir);
            if (omarchyFile.query_exists(null)) {
                const fileInfo = omarchyFile.query_info(
                    'standard::is-symlink',
                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                    null
                );

                if (!fileInfo.get_is_symlink()) {
                    console.log('Removing existing omarchy theme directory...');
                    omarchyFile.trash(null);
                }
            }

            createSymlink(this.themeDir, this.omarchyThemeDir, 'omarchy theme');
        } catch (e) {
            console.error('Error creating omarchy symlink:', e.message);
        }
    }

    /**
     * Copies wallpaper to theme backgrounds directory
     * @param {string} sourcePath - Source wallpaper path
     * @private
     */
    _copyWallpaper(sourcePath) {
        const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);
        const fileName = GLib.path_get_basename(sourcePath);
        const destPath = GLib.build_filenamev([bgDir, fileName]);

        const success = copyFile(sourcePath, destPath);
        if (success) {
            this.wallpaperPath = destPath;
        }
        return destPath;
    }

    _copyAdditionalImages(images) {
        const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);

        images.forEach((sourcePath, index) => {
            const fileName = GLib.path_get_basename(sourcePath);
            const destPath = GLib.build_filenamev([bgDir, fileName]);

            const success = copyFile(sourcePath, destPath);
            if (success) {
                console.log(
                    `Copied additional image ${index + 1}: ${fileName}`
                );
            } else {
                console.error(`Failed to copy additional image: ${fileName}`);
            }
        });
    }

    _buildVariables(colorRoles, lightMode = false) {
        const variables = {};

        // Use default colors as fallback (now uses semantic names)
        Object.keys(DEFAULT_COLORS).forEach(key => {
            variables[key] = colorRoles[key] || DEFAULT_COLORS[key];
        });

        // Add color0-15 aliases for backwards compatibility with existing templates
        const indexAliases = {
            color0: variables.black,
            color1: variables.red,
            color2: variables.green,
            color3: variables.yellow,
            color4: variables.blue,
            color5: variables.magenta,
            color6: variables.cyan,
            color7: variables.white,
            color8: variables.bright_black,
            color9: variables.bright_red,
            color10: variables.bright_green,
            color11: variables.bright_yellow,
            color12: variables.bright_blue,
            color13: variables.bright_magenta,
            color14: variables.bright_cyan,
            color15: variables.bright_white,
        };

        // Add index aliases to variables
        Object.assign(variables, indexAliases);

        // Add theme type for VSCode and other templates
        variables.theme_type = lightMode ? 'light' : 'dark';

        return variables;
    }

    _processTemplates(variables, settings = {}, appOverrides = {}) {
        const templateMap = getTemplateMap();

        templateMap.forEach((templatePath, fileName) => {
            // Skip copy.json - it's a config file, not a template
            if (fileName === 'copy.json') {
                return;
            }

            // Skip apps directory - processed separately
            if (templatePath.includes('/apps/')) {
                return;
            }

            // Skip scripts directory contents (legacy)
            if (templatePath.includes('/scripts/')) {
                return;
            }

            // Skip neovim.lua if includeNeovim is false
            if (fileName === 'neovim.lua' && settings.includeNeovim === false) {
                return;
            }

            // Skip vencord.theme.css if includeVencord is false
            if (
                fileName === 'vencord.theme.css' &&
                settings.includeVencord === false
            ) {
                return;
            }

            // Skip aether.zed.json if includeZed is false
            if (
                fileName === 'aether.zed.json' &&
                settings.includeZed === false
            ) {
                return;
            }

            // Skip gtk.css if includeGtk is false
            if (fileName === 'gtk.css' && settings.includeGtk === false) {
                return;
            }

            const outputPath = GLib.build_filenamev([this.themeDir, fileName]);

            // Handle vscode.empty.json - use when VSCode is disabled
            if (fileName === 'vscode.empty.json') {
                if (settings.includeVscode === false) {
                    // Write empty vscode.json when disabled
                    const vscodeOutputPath = GLib.build_filenamev([
                        this.themeDir,
                        'vscode.json',
                    ]);
                    this._processTemplate(
                        templatePath,
                        vscodeOutputPath,
                        variables,
                        'vscode.empty.json',
                        appOverrides
                    );
                }
                return;
            }

            // If this is neovim.lua and a custom config is selected, write it directly
            if (fileName === 'neovim.lua' && settings.selectedNeovimConfig) {
                try {
                    writeTextToFile(outputPath, settings.selectedNeovimConfig);
                    console.log(
                        `Applied selected Neovim theme to ${outputPath}`
                    );
                } catch (e) {
                    console.error(
                        `Error writing custom neovim.lua:`,
                        e.message
                    );
                }
                return;
            }

            this._processTemplate(
                templatePath,
                outputPath,
                variables,
                fileName,
                appOverrides
            );
        });
    }

    _processTemplate(
        templatePath,
        outputPath,
        variables,
        fileName,
        appOverrides = {}
    ) {
        try {
            const content = readFileAsText(templatePath);
            let processed = content;

            // Check if there are app-specific overrides for this template
            // Map fileName to app name (remove extension)
            const appName = this._getAppNameFromFileName(fileName);
            const appSpecificOverrides = appOverrides[appName] || {};

            // Merge app-specific overrides with base variables
            const mergedVariables = {...variables, ...appSpecificOverrides};

            Object.entries(mergedVariables).forEach(([key, value]) => {
                processed = this._replaceVariable(processed, key, value);
            });

            writeTextToFile(outputPath, processed);

            if (Object.keys(appSpecificOverrides).length > 0) {
                console.log(
                    `Applied ${Object.keys(appSpecificOverrides).length} override(s) to ${fileName}`
                );
            }
        } catch (e) {
            console.error(
                `Error processing template ${templatePath}:`,
                e.message
            );
        }
    }

    _getAppNameFromFileName(fileName) {
        return getAppNameFromFileName(fileName);
    }

    _replaceVariable(content, key, value) {
        // Replace {key}
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        let result = content.replace(regex, value);

        // Replace {key.strip} (removes # from hex colors)
        const stripRegex = new RegExp(`\\{${key}\\.strip\\}`, 'g');
        const strippedValue =
            typeof value === 'string' ? value.replace('#', '') : value;
        result = result.replace(stripRegex, strippedValue);

        // Replace {key.rgb} (converts hex to decimal RGB: r,g,b)
        const rgbRegex = new RegExp(`\\{${key}\\.rgb\\}`, 'g');
        if (typeof value === 'string' && value.startsWith('#')) {
            const rgbValue = hexToRgbString(value);
            result = result.replace(rgbRegex, rgbValue);
        } else {
            result = result.replace(rgbRegex, value);
        }

        // Replace {key.rgba} (converts hex to rgba format with optional alpha)
        // Supports {key.rgba} (default alpha 1.0) or {key.rgba:0.5} (custom alpha)
        const rgbaRegex = new RegExp(
            `\\{${key}\\.rgba(?::(\\d*\\.?\\d+))?\\}`,
            'g'
        );
        if (typeof value === 'string' && value.startsWith('#')) {
            result = result.replace(rgbaRegex, (match, alpha) => {
                const alphaValue = alpha ? parseFloat(alpha) : 1.0;
                return hexToRgba(value, alphaValue);
            });
        } else {
            result = result.replace(rgbaRegex, value);
        }

        // Replace {key.yaru} (maps color to Yaru icon theme variant)
        const yaruRegex = new RegExp(`\\{${key}\\.yaru\\}`, 'g');
        if (typeof value === 'string' && value.startsWith('#')) {
            const yaruTheme = hexToYaruTheme(value);
            result = result.replace(yaruRegex, yaruTheme);
        } else {
            result = result.replace(yaruRegex, value);
        }

        return result;
    }

    exportTheme(
        colorRoles,
        wallpaperPath,
        exportPath,
        themeName,
        settings = {},
        lightMode = false,
        appOverrides = {}
    ) {
        try {
            ensureDirectoryExists(exportPath);

            const bgDir = GLib.build_filenamev([exportPath, 'backgrounds']);
            ensureDirectoryExists(bgDir);

            if (wallpaperPath) {
                const fileName = GLib.path_get_basename(wallpaperPath);
                const destPath = GLib.build_filenamev([bgDir, fileName]);
                copyFile(wallpaperPath, destPath);
                console.log(`Copied wallpaper to: ${destPath}`);
            }

            const variables = this._buildVariables(colorRoles, lightMode);
            this._processTemplatesToDirectory(
                variables,
                exportPath,
                settings,
                appOverrides
            );
            this._handleLightModeMarker(exportPath, lightMode);

            console.log(`Theme exported successfully to: ${exportPath}`);
            return true;
        } catch (e) {
            console.error('Error exporting theme:', e.message);
            throw e;
        }
    }

    _processTemplatesToDirectory(
        variables,
        exportPath,
        settings = {},
        appOverrides = {}
    ) {
        const templateMap = getTemplateMap();

        templateMap.forEach((templatePath, fileName) => {
            // Skip neovim.lua if includeNeovim is false
            if (fileName === 'neovim.lua' && settings.includeNeovim === false) {
                return;
            }

            // Skip vencord.theme.css if includeVencord is false
            if (
                fileName === 'vencord.theme.css' &&
                settings.includeVencord === false
            ) {
                return;
            }

            // Skip aether.zed.json if includeZed is false
            if (
                fileName === 'aether.zed.json' &&
                settings.includeZed === false
            ) {
                return;
            }

            // Skip gtk.css if includeGtk is false
            if (fileName === 'gtk.css' && settings.includeGtk === false) {
                return;
            }

            const outputPath = GLib.build_filenamev([exportPath, fileName]);

            // Handle vscode.empty.json - use when VSCode is disabled
            if (fileName === 'vscode.empty.json') {
                if (settings.includeVscode === false) {
                    // Write empty vscode.json when disabled
                    const vscodeOutputPath = GLib.build_filenamev([
                        exportPath,
                        'vscode.json',
                    ]);
                    this._processTemplate(
                        templatePath,
                        vscodeOutputPath,
                        variables,
                        'vscode.empty.json',
                        appOverrides
                    );
                }
                return;
            }

            // If this is neovim.lua and a custom config is selected, write it directly
            if (fileName === 'neovim.lua' && settings.selectedNeovimConfig) {
                try {
                    writeTextToFile(outputPath, settings.selectedNeovimConfig);
                    console.log(
                        `Exported selected Neovim theme to ${outputPath}`
                    );
                } catch (e) {
                    console.error(
                        `Error writing custom neovim.lua:`,
                        e.message
                    );
                }
                return;
            }

            this._processTemplate(
                templatePath,
                outputPath,
                variables,
                fileName,
                appOverrides
            );
            console.log(`Processed template: ${fileName}`);
        });
    }

    /**
     * Processes templates from app folders in ~/.config/aether/custom/
     * @param {Object} variables - Template variables
     * @param {Object} appOverrides - Per-app color overrides
     * @private
     */
    _processAppTemplates(variables, appOverrides = {}) {
        try {
            const appsDir = GLib.build_filenamev([
                this.configDir,
                'aether',
                'custom',
            ]);

            if (!fileExists(appsDir)) {
                return;
            }

            enumerateDirectory(appsDir, (fileInfo, appPath, appName) => {
                if (fileInfo.get_file_type() !== Gio.FileType.DIRECTORY) {
                    return;
                }

                const configPath = GLib.build_filenamev([
                    appPath,
                    'config.json',
                ]);
                if (!fileExists(configPath)) {
                    return;
                }

                const config = loadJsonFile(configPath, null);
                if (!config || !config.template) {
                    return;
                }

                const templatePath = GLib.build_filenamev([
                    appPath,
                    config.template,
                ]);
                if (!fileExists(templatePath)) {
                    return;
                }

                // Output file named: appName-templateName
                const outputFileName = `${appName}-${config.template}`;
                const outputPath = GLib.build_filenamev([
                    this.themeDir,
                    outputFileName,
                ]);

                // Process template with variables
                this._processTemplate(
                    templatePath,
                    outputPath,
                    variables,
                    outputFileName,
                    appOverrides
                );

                console.log(
                    `[${appName}] Processed template: ${config.template}`
                );
            });
        } catch (e) {
            console.error('Error processing app templates:', e.message);
        }
    }

    _handleLightModeMarker(themeDir, lightMode) {
        const markerPath = GLib.build_filenamev([themeDir, 'light.mode']);
        const file = Gio.File.new_for_path(markerPath);

        if (lightMode) {
            // Create empty light.mode file
            try {
                file.create(Gio.FileCreateFlags.NONE, null);
                console.log('Created light.mode marker file');
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                    console.error('Error creating light.mode file:', e.message);
                }
            }
        } else {
            // Remove light.mode file if it exists
            try {
                if (file.query_exists(null)) {
                    file.delete(null);
                    console.log('Removed light.mode marker file');
                }
            } catch (e) {
                console.error('Error removing light.mode file:', e.message);
            }
        }
    }

    /**
     * Processes custom app folders from user config directory
     * Each folder can contain: config.json, template file(s), post-apply.sh
     *
     * Structure:
     * ~/.config/aether/
     * └── custom/
     *     ├── cava/
     *     │   ├── config.json      # { "template": "theme.ini", "destination": "~/.config/cava/themes/aether" }
     *     │   ├── theme.ini        # Template file with {color} variables
     *     │   └── post-apply.sh    # Optional script to run after
     *     └── another-app/
     *         └── ...
     *
     * @private
     */
    _processSymlinks() {
        try {
            const appsDir = GLib.build_filenamev([
                this.configDir,
                'aether',
                'custom',
            ]);

            if (!fileExists(appsDir)) {
                return;
            }

            // Enumerate app folders
            enumerateDirectory(appsDir, (fileInfo, appPath, appName) => {
                // Only process directories
                if (fileInfo.get_file_type() !== Gio.FileType.DIRECTORY) {
                    return;
                }

                this._processAppFolder(appPath, appName);
            });
        } catch (e) {
            console.error('Error processing app folders:', e.message);
        }
    }

    /**
     * Processes a single app folder
     * @param {string} appPath - Full path to the app folder
     * @param {string} appName - Name of the app folder
     * @private
     */
    _processAppFolder(appPath, appName) {
        try {
            const configPath = GLib.build_filenamev([appPath, 'config.json']);

            if (!fileExists(configPath)) {
                console.warn(
                    `App folder '${appName}' missing config.json, skipping`
                );
                return;
            }

            const config = loadJsonFile(configPath, null);
            if (!config || !config.template || !config.destination) {
                console.warn(`App folder '${appName}' has invalid config.json`);
                return;
            }

            // Source is the generated file in theme directory (named after app folder)
            const generatedFileName = `${appName}-${config.template}`;
            const sourcePath = GLib.build_filenamev([
                this.themeDir,
                generatedFileName,
            ]);

            // The template file in the app folder
            const templatePath = GLib.build_filenamev([
                appPath,
                config.template,
            ]);

            if (!fileExists(templatePath)) {
                console.warn(
                    `Template '${config.template}' not found in ${appName}/`
                );
                return;
            }

            // Expand ~ in destination path
            let destPath = config.destination;
            if (destPath.startsWith('~/')) {
                destPath = GLib.build_filenamev([
                    GLib.get_home_dir(),
                    destPath.slice(2),
                ]);
            }

            // Ensure destination directory exists
            const destDir = GLib.path_get_dirname(destPath);
            ensureDirectoryExists(destDir);

            // Create symlink
            const success = createSymlink(sourcePath, destPath, appName);

            if (success) {
                console.log(`[${appName}] Symlinked -> ${destPath}`);

                // Run post-apply.sh if it exists
                const postApplyPath = GLib.build_filenamev([
                    appPath,
                    'post-apply.sh',
                ]);
                if (fileExists(postApplyPath)) {
                    this._runPostApplyScript(postApplyPath, appName);
                }
            }
        } catch (e) {
            console.error(
                `Error processing app folder '${appName}':`,
                e.message
            );
        }
    }

    /**
     * Runs a post-apply script
     * @param {string} scriptPath - Full path to the script
     * @param {string} appName - Name of the app (for logging)
     * @private
     */
    _runPostApplyScript(scriptPath, appName) {
        try {
            GLib.spawn_command_line_async(`bash "${scriptPath}"`);
            console.log(`[${appName}] Executed post-apply.sh`);
        } catch (e) {
            console.error(
                `[${appName}] Error running post-apply.sh:`,
                e.message
            );
        }
    }

    _applyAetherThemeOverride(variables) {
        try {
            // Process the aether.override.css template
            const templatePath = resolveTemplatePath('aether.override.css');

            // Write to omarchy themes folder (with other config files)
            const themeOverridePath = GLib.build_filenamev([
                this.themeDir,
                'aether.override.css',
            ]);

            // Process the template with color variables
            this._processTemplate(
                templatePath,
                themeOverridePath,
                variables,
                'aether.override.css'
            );

            // Create symlink from ~/.config/aether/theme.override.css to the generated file
            const aetherConfigDir = GLib.build_filenamev([
                this.configDir,
                'aether',
            ]);
            const symlinkPath = GLib.build_filenamev([
                aetherConfigDir,
                'theme.override.css',
            ]);

            // Create symlink from ~/.config/aether/theme.override.css to the generated file
            createSymlink(themeOverridePath, symlinkPath, 'theme override');

            console.log(
                `Applied Aether theme override to ${themeOverridePath}`
            );
        } catch (e) {
            console.error('Error applying Aether theme override:', e.message);
        }
    }

    /**
     * Applies the Aether theme to the system
     * sync mode is needed for the CLI application to work properly
     */
    _applyOmarchyTheme(sync = false) {
        try {
            // Clear LD_PRELOAD to prevent layer-shell conflicts with waybar
            // when running from widget mode
            const command = 'env -u LD_PRELOAD omarchy-theme-set aether';

            if (sync) {
                GLib.spawn_command_line_sync(command);
            } else {
                GLib.spawn_command_line_async(command);
            }
            console.log('Applied theme: aether');

            // Restart xdg-desktop-portal-gtk to pick up new theme
            try {
                if (sync) {
                    GLib.spawn_command_line_sync(
                        'killall xdg-desktop-portal-gtk'
                    );
                } else {
                    GLib.spawn_command_line_async(
                        'killall xdg-desktop-portal-gtk'
                    );
                }
                console.log(
                    'Restarting xdg-desktop-portal-gtk for theme update'
                );
            } catch (e) {
                console.log(
                    'Could not restart portal (may not be running):',
                    e.message
                );
            }
        } catch (e) {
            console.error('Error applying omarchy theme:', e.message);
        }
    }

    applyWallpaper(wallpaperPath) {
        try {
            console.log('Applying wallpaper from path:', wallpaperPath);
            if (wallpaperPath) {
                // Create symlink ~/.config/omarchy/current/background -> wallpaperPath
                const symlinkPath = GLib.build_filenamev([
                    this.configDir,
                    'omarchy',
                    'current',
                    'background',
                ]);
                createSymlink(wallpaperPath, symlinkPath, 'wallpaper');
                // Restart swaybg using the symlink (no path needed, it uses the symlink)
                restartSwaybg();
            }
        } catch (e) {
            console.error('Error applying wallpaper:', e.message);
        }
    }

    clearTheme() {
        try {
            // Delete GTK3 css file
            const gtk3CssPath = GLib.build_filenamev([
                this.configDir,
                'gtk-3.0',
                'gtk.css',
            ]);
            if (fileExists(gtk3CssPath)) {
                deleteFile(gtk3CssPath);
                console.log(`Deleted GTK3 css: ${gtk3CssPath}`);
            }

            // Delete GTK4 css file
            const gtk4CssPath = GLib.build_filenamev([
                this.configDir,
                'gtk-4.0',
                'gtk.css',
            ]);
            if (fileExists(gtk4CssPath)) {
                deleteFile(gtk4CssPath);
                console.log(`Deleted GTK4 css: ${gtk4CssPath}`);
            }

            // Delete Aether override CSS symlink
            const aetherOverrideSymlink = GLib.build_filenamev([
                this.configDir,
                'aether',
                'theme.override.css',
            ]);
            if (fileExists(aetherOverrideSymlink)) {
                deleteFile(aetherOverrideSymlink);
                console.log(
                    `Deleted Aether theme override symlink: ${aetherOverrideSymlink}`
                );
            }

            // Delete Aether override CSS file in omarchy themes
            const aetherOverrideCss = GLib.build_filenamev([
                this.themeDir,
                'aether.override.css',
            ]);
            if (fileExists(aetherOverrideCss)) {
                deleteFile(aetherOverrideCss);
                console.log(
                    `Deleted Aether theme override CSS: ${aetherOverrideCss}`
                );
            }

            // Switch to tokyo-night theme
            GLib.spawn_command_line_async('omarchy-theme-set tokyo-night');
            console.log('Cleared Aether theme and switched to tokyo-night');

            // Restart xdg-desktop-portal-gtk to pick up new theme
            try {
                GLib.spawn_command_line_async('killall xdg-desktop-portal-gtk');
                console.log(
                    'Restarting xdg-desktop-portal-gtk for theme update'
                );
            } catch (e) {
                console.log(
                    'Could not restart portal (may not be running):',
                    e.message
                );
            }

            return true;
        } catch (e) {
            console.error('Error clearing theme:', e.message);
            return false;
        }
    }
}
