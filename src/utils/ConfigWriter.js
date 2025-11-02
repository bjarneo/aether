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
import {hexToRgbString, hexToRgba, hexToYaruTheme} from './color-utils.js';
import {
    restartSwaybg,
    copyVencordTheme,
    copyZedTheme,
} from './service-manager.js';
import {DEFAULT_COLORS} from '../constants/colors.js';
import {getAppNameFromFileName} from '../constants/templates.js';

export class ConfigWriter {
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
        this.themeDir = GLib.build_filenamev([
            this.configDir,
            'omarchy',
            'themes',
            'aether',
        ]);
        this.wallpaperPath = null;
    }

    applyTheme(
        colorRoles,
        wallpaperPath,
        settings = {},
        lightMode = false,
        appOverrides = {},
        additionalImages = [],
        sync = false
    ) {
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
                this._createGtkSymlinks();
            }

            // Copy Vencord theme to all existing installations if enabled
            if (settings.includeVencord === true) {
                this._copyVencordTheme();
            }

            // Copy Zed theme if enabled
            if (settings.includeZed === true) {
                this._copyZedTheme();
            }

            // Copy VSCode theme if enabled
            if (settings.includeVscode === true) {
                this._copyVscodeTheme(variables);
            }

            this._handleLightModeMarker(this.themeDir, lightMode);
            this._applyOmarchyTheme(sync);

            return true;
        } catch (e) {
            console.error('Error applying theme:', e.message);
            return false;
        }
    }

    _createThemeDirectory() {
        ensureDirectoryExists(this.themeDir);

        const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);
        ensureDirectoryExists(bgDir);
        cleanDirectory(bgDir);
    }

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

        // Use default colors as fallback
        Object.keys(DEFAULT_COLORS).forEach(key => {
            variables[key] = colorRoles[key] || DEFAULT_COLORS[key];
        });

        // Add theme type for VSCode and other templates
        variables.theme_type = lightMode ? 'light' : 'dark';

        return variables;
    }

    _processTemplates(variables, settings = {}, appOverrides = {}) {
        enumerateDirectory(
            this.templatesDir,
            (fileInfo, templatePath, fileName) => {
                // Skip neovim.lua if includeNeovim is false
                if (
                    fileName === 'neovim.lua' &&
                    settings.includeNeovim === false
                ) {
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

                const outputPath = GLib.build_filenamev([
                    this.themeDir,
                    fileName,
                ]);

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
                if (
                    fileName === 'neovim.lua' &&
                    settings.selectedNeovimConfig
                ) {
                    try {
                        writeTextToFile(
                            outputPath,
                            settings.selectedNeovimConfig
                        );
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
            }
        );
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

            // Set special permissions for gtk.css (chmod 644)
            if (fileName === 'gtk.css') {
                this._setFilePermissions(outputPath, 0o644);
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
        enumerateDirectory(
            this.templatesDir,
            (fileInfo, templatePath, fileName) => {
                // Skip neovim.lua if includeNeovim is false
                if (
                    fileName === 'neovim.lua' &&
                    settings.includeNeovim === false
                ) {
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
                if (
                    fileName === 'neovim.lua' &&
                    settings.selectedNeovimConfig
                ) {
                    try {
                        writeTextToFile(
                            outputPath,
                            settings.selectedNeovimConfig
                        );
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
            }
        );
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

    _applyAetherThemeOverride(variables) {
        try {
            // Process the aether.override.css template
            const templatePath = GLib.build_filenamev([
                this.templatesDir,
                'aether.override.css',
            ]);

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

    _createGtkSymlinks() {
        try {
            // Source: ~/.config/omarchy/themes/aether/gtk.css
            const gtkSourcePath = GLib.build_filenamev([
                this.themeDir,
                'gtk.css',
            ]);

            // Check if source file exists
            const sourceFile = Gio.File.new_for_path(gtkSourcePath);
            if (!sourceFile.query_exists(null)) {
                console.log(
                    'gtk.css not found in theme directory, skipping GTK copies'
                );
                return;
            }

            // GTK3 destination: ~/.config/gtk-3.0/gtk.css
            const gtk3ConfigDir = GLib.build_filenamev([
                this.configDir,
                'gtk-3.0',
            ]);
            const gtk3DestPath = GLib.build_filenamev([
                gtk3ConfigDir,
                'gtk.css',
            ]);

            // GTK4 destination: ~/.config/gtk-4.0/gtk.css
            const gtk4ConfigDir = GLib.build_filenamev([
                this.configDir,
                'gtk-4.0',
            ]);
            const gtk4DestPath = GLib.build_filenamev([
                gtk4ConfigDir,
                'gtk.css',
            ]);

            // Ensure GTK config directories exist
            ensureDirectoryExists(gtk3ConfigDir);
            ensureDirectoryExists(gtk4ConfigDir);

            // Copy to GTK3
            this._copyGtkFile(gtkSourcePath, gtk3DestPath, 'GTK3');

            // Copy to GTK4
            this._copyGtkFile(gtkSourcePath, gtk4DestPath, 'GTK4');

            console.log('GTK files copied successfully');
        } catch (e) {
            console.error('Error copying GTK files:', e.message);
        }
    }

    _copyVencordTheme() {
        try {
            const vencordSourcePath = GLib.build_filenamev([
                this.themeDir,
                'vencord.theme.css',
            ]);

            // Check if source file exists
            const sourceFile = Gio.File.new_for_path(vencordSourcePath);
            if (!sourceFile.query_exists(null)) {
                console.log(
                    'vencord.theme.css not found in theme directory, skipping Vencord copy'
                );
                return;
            }

            // Copy to all existing Vencord/Vesktop installations
            copyVencordTheme(vencordSourcePath);
        } catch (e) {
            console.error('Error copying Vencord theme:', e.message);
        }
    }

    _copyZedTheme() {
        try {
            const zedSourcePath = GLib.build_filenamev([
                this.themeDir,
                'aether.zed.json',
            ]);

            // Check if source file exists
            const sourceFile = Gio.File.new_for_path(zedSourcePath);
            if (!sourceFile.query_exists(null)) {
                console.log(
                    'aether.zed.json not found in theme directory, skipping Zed copy'
                );
                return;
            }

            // Copy to ~/.config/zed/themes/
            copyZedTheme(zedSourcePath);
        } catch (e) {
            console.error('Error copying Zed theme:', e.message);
        }
    }

    _copyVscodeTheme(variables) {
        try {
            const homeDir = GLib.get_home_dir();
            const vscodeExtensionPath = GLib.build_filenamev([
                homeDir,
                '.vscode',
                'extensions',
                'theme-aether',
            ]);

            // Ensure the extension directory exists
            ensureDirectoryExists(vscodeExtensionPath);

            // Process the entire vscode-extension folder from templates
            const vscodeTemplateDir = GLib.build_filenamev([
                this.templatesDir,
                'vscode-extension',
            ]);

            // Copy and process all files from vscode-extension template
            this._copyVscodeExtensionDirectory(
                vscodeTemplateDir,
                vscodeExtensionPath,
                variables
            );

            console.log(
                `Installed VSCode extension to: ${vscodeExtensionPath}`
            );
        } catch (e) {
            console.error('Error copying VSCode theme:', e.message);
        }
    }

    _copyVscodeExtensionDirectory(sourceDir, destDir, variables) {
        enumerateDirectory(sourceDir, (fileInfo, filePath, fileName) => {
            const fileType = fileInfo.get_file_type();

            if (fileType === Gio.FileType.DIRECTORY) {
                // Recursively process subdirectories
                const subSourceDir = GLib.build_filenamev([
                    sourceDir,
                    fileName,
                ]);
                const subDestDir = GLib.build_filenamev([destDir, fileName]);
                ensureDirectoryExists(subDestDir);
                this._copyVscodeExtensionDirectory(
                    subSourceDir,
                    subDestDir,
                    variables
                );
            } else if (fileType === Gio.FileType.REGULAR) {
                // Process and copy file
                const destPath = GLib.build_filenamev([destDir, fileName]);
                this._processTemplate(filePath, destPath, variables, fileName);
                console.log(`Processed VSCode extension file: ${fileName}`);
            }
        });
    }

    _copyGtkFile(sourcePath, destPath, label) {
        try {
            // Remove existing file if it exists
            const destFile = Gio.File.new_for_path(destPath);
            if (destFile.query_exists(null)) {
                try {
                    destFile.delete(null);
                } catch (e) {
                    console.error(
                        `Error removing existing ${label} gtk.css:`,
                        e.message
                    );
                    return;
                }
            }

            // Copy the file
            const success = copyFile(sourcePath, destPath);
            if (success) {
                console.log(`Copied ${label} gtk.css to ${destPath}`);
                // Set permissions to 644 after copying
                this._setFilePermissions(destPath, 0o644);
            } else {
                console.error(`Failed to copy ${label} gtk.css`);
            }
        } catch (e) {
            console.error(`Error in _copyGtkFile for ${label}:`, e.message);
        }
    }

    _setFilePermissions(filePath, mode) {
        try {
            const file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) {
                console.error(`File not found for chmod: ${filePath}`);
                return;
            }

            // Use GLib.chmod (octal mode)
            const result = GLib.chmod(filePath, mode);
            if (result === 0) {
                console.log(
                    `Set permissions ${mode.toString(8)} on ${filePath}`
                );
            } else {
                console.error(
                    `Failed to chmod ${filePath}: returned ${result}`
                );
            }
        } catch (e) {
            console.error(
                `Error setting permissions on ${filePath}:`,
                e.message
            );
        }
    }

    /**
     * Applies the Aether theme to the system
     * sync mode is needed for the CLI application to work properly
     */
    _applyOmarchyTheme(sync = false) {
        try {
            if (sync) {
                GLib.spawn_command_line_sync('omarchy-theme-set aether');
            } else {
                GLib.spawn_command_line_async('omarchy-theme-set aether');
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
                restartSwaybg(wallpaperPath);
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
