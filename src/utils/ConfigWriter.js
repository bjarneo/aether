import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    readFileAsText,
    writeTextToFile,
    copyFile,
    ensureDirectoryExists,
    cleanDirectory,
    enumerateDirectory,
} from './file-utils.js';
import {hexToRgbString, hexToYaruTheme} from './color-utils.js';
import {DEFAULT_COLORS} from '../constants/colors.js';

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

    applyTheme(colorRoles, wallpaperPath, settings = {}, lightMode = false) {
        try {
            this._createThemeDirectory();

            if (wallpaperPath) {
                this._copyWallpaper(wallpaperPath);
            }

            const variables = this._buildVariables(colorRoles);
            this._processTemplates(variables, settings);
            this._applyAetherThemeOverride(variables);

            // Only apply GTK theming if enabled
            if (settings.includeGtk === true) {
                this._createGtkSymlinks();
            }

            this._handleLightModeMarker(this.themeDir, lightMode);
            this._applyOmarchyTheme();

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

    _buildVariables(colorRoles) {
        const variables = {};

        // Use default colors as fallback
        Object.keys(DEFAULT_COLORS).forEach(key => {
            variables[key] = colorRoles[key] || DEFAULT_COLORS[key];
        });

        return variables;
    }

    _processTemplates(variables, settings = {}) {
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

                // Skip gtk.css if includeGtk is false
                if (
                    fileName === 'gtk.css' &&
                    settings.includeGtk === false
                ) {
                    return;
                }

                const outputPath = GLib.build_filenamev([
                    this.themeDir,
                    fileName,
                ]);

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

                this._processTemplate(templatePath, outputPath, variables);
            }
        );
    }

    _processTemplate(templatePath, outputPath, variables) {
        try {
            const content = readFileAsText(templatePath);
            let processed = content;

            Object.entries(variables).forEach(([key, value]) => {
                processed = this._replaceVariable(processed, key, value);
            });

            writeTextToFile(outputPath, processed);

            // Set special permissions for gtk.css (chmod 644)
            const fileName = GLib.path_get_basename(outputPath);
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
        lightMode = false
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

            const variables = this._buildVariables(colorRoles);
            this._processTemplatesToDirectory(variables, exportPath, settings);
            this._handleLightModeMarker(exportPath, lightMode);

            console.log(`Theme exported successfully to: ${exportPath}`);
            return true;
        } catch (e) {
            console.error('Error exporting theme:', e.message);
            throw e;
        }
    }

    _processTemplatesToDirectory(variables, exportPath, settings = {}) {
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

                const outputPath = GLib.build_filenamev([exportPath, fileName]);

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

                this._processTemplate(templatePath, outputPath, variables);
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
            this._processTemplate(templatePath, themeOverridePath, variables);

            // Create symlink from ~/.config/aether/theme.override.css to the generated file
            const aetherConfigDir = GLib.build_filenamev([
                this.configDir,
                'aether',
            ]);
            const symlinkPath = GLib.build_filenamev([
                aetherConfigDir,
                'theme.override.css',
            ]);

            // Ensure aether config directory exists
            ensureDirectoryExists(aetherConfigDir);

            // Remove existing symlink or file if it exists
            const symlinkFile = Gio.File.new_for_path(symlinkPath);
            if (symlinkFile.query_exists(null)) {
                try {
                    symlinkFile.delete(null);
                } catch (e) {
                    console.error(
                        'Error removing existing theme.override.css:',
                        e.message
                    );
                }
            }

            // Create symlink
            try {
                const symlinkGFile = Gio.File.new_for_path(symlinkPath);
                symlinkGFile.make_symbolic_link(themeOverridePath, null);
                console.log(
                    `Created symlink: ${symlinkPath} -> ${themeOverridePath}`
                );
            } catch (e) {
                console.error('Error creating symlink:', e.message);
                // Fallback: copy the file if symlink fails
                copyFile(themeOverridePath, symlinkPath);
                console.log(`Fallback: Copied file to ${symlinkPath}`);
            }

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
                console.log('gtk.css not found in theme directory, skipping GTK copies');
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
                console.log(`Set permissions ${mode.toString(8)} on ${filePath}`);
            } else {
                console.error(`Failed to chmod ${filePath}: returned ${result}`);
            }
        } catch (e) {
            console.error(`Error setting permissions on ${filePath}:`, e.message);
        }
    }

    _applyOmarchyTheme() {
        try {
            GLib.spawn_command_line_async('omarchy-theme-set aether');
            console.log('Applied theme: aether');
            
            // Restart xdg-desktop-portal-gtk to pick up new theme
            try {
                GLib.spawn_command_line_async('killall xdg-desktop-portal-gtk');
                console.log('Restarting xdg-desktop-portal-gtk for theme update');
            } catch (e) {
                console.log('Could not restart portal (may not be running):', e.message);
            }
        } catch (e) {
            console.error('Error applying omarchy theme:', e.message);
        }
    }
}
