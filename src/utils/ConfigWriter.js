import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    readFileAsText,
    writeTextToFile,
    copyFile,
    ensureDirectoryExists,
    cleanDirectory,
    enumerateDirectory
} from './file-utils.js';
import { hexToRgbString, hexToYaruTheme } from './color-utils.js';
import { DEFAULT_COLORS } from '../constants/colors.js';

export class ConfigWriter {
    constructor() {
        this.configDir = GLib.get_user_config_dir();
        this.projectDir = GLib.path_get_dirname(GLib.path_get_dirname(GLib.path_get_dirname(
            Gio.File.new_for_path(import.meta.url.replace('file://', '')).get_path()
        )));
        this.templatesDir = GLib.build_filenamev([this.projectDir, 'templates']);
        this.themeDir = GLib.build_filenamev([this.configDir, 'omarchy', 'themes', 'aether']);
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
        enumerateDirectory(this.templatesDir, (fileInfo, templatePath, fileName) => {
            // Skip neovim.lua if includeNeovim is false
            if (fileName === 'neovim.lua' && settings.includeNeovim === false) {
                return;
            }

            // Skip vencord.theme.css if includeVencord is false
            if (fileName === 'vencord.theme.css' && settings.includeVencord === false) {
                return;
            }

            const outputPath = GLib.build_filenamev([this.themeDir, fileName]);
            this._processTemplate(templatePath, outputPath, variables);
        });
    }

    _processTemplate(templatePath, outputPath, variables) {
        try {
            const content = readFileAsText(templatePath);
            let processed = content;

            Object.entries(variables).forEach(([key, value]) => {
                processed = this._replaceVariable(processed, key, value);
            });

            writeTextToFile(outputPath, processed);
        } catch (e) {
            console.error(`Error processing template ${templatePath}:`, e.message);
        }
    }

    _replaceVariable(content, key, value) {
        // Replace {key}
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        let result = content.replace(regex, value);

        // Replace {key.strip} (removes # from hex colors)
        const stripRegex = new RegExp(`\\{${key}\\.strip\\}`, 'g');
        const strippedValue = typeof value === 'string' ? value.replace('#', '') : value;
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

    exportTheme(colorRoles, wallpaperPath, exportPath, themeName, settings = {}, lightMode = false) {
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
        enumerateDirectory(this.templatesDir, (fileInfo, templatePath, fileName) => {
            // Skip neovim.lua if includeNeovim is false
            if (fileName === 'neovim.lua' && settings.includeNeovim === false) {
                return;
            }

            // Skip vencord.theme.css if includeVencord is false
            if (fileName === 'vencord.theme.css' && settings.includeVencord === false) {
                return;
            }

            const outputPath = GLib.build_filenamev([exportPath, fileName]);
            this._processTemplate(templatePath, outputPath, variables);
            console.log(`Processed template: ${fileName}`);
        });
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

    _applyOmarchyTheme() {
        try {
            GLib.spawn_command_line_async('omarchy-theme-set aether');
            console.log('Applied theme: aether');
        } catch (e) {
            console.error('Error applying omarchy theme:', e.message);
        }
    }
}
