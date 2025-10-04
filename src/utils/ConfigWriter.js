import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

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

    // Apply theme using templates
    applyTheme(colorRoles, wallpaperPath) {
        try {
            // Create theme directory structure
            this.createThemeDirectory();

            // Copy wallpaper
            if (wallpaperPath) {
                this.copyWallpaper(wallpaperPath);
            }

            // Build color variables
            const variables = this.buildVariables(colorRoles);

            // Process all templates
            this.processTemplates(variables);

            // Apply theme via omarchy
            this.applyOmarchyTheme();

            return true;
        } catch (e) {
            console.error('Error applying theme:', e.message);
            return false;
        }
    }

    createThemeDirectory() {
        // Create main theme directory
        GLib.mkdir_with_parents(this.themeDir, 0o755);

        // Create backgrounds directory
        const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);
        GLib.mkdir_with_parents(bgDir, 0o755);

        // Clean backgrounds directory
        this.cleanBackgroundsDirectory(bgDir);
    }

    cleanBackgroundsDirectory(bgDir) {
        try {
            const dir = Gio.File.new_for_path(bgDir);

            if (!dir.query_exists(null)) {
                return;
            }

            const enumerator = dir.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const fileName = fileInfo.get_name();
                const filePath = GLib.build_filenamev([bgDir, fileName]);
                const file = Gio.File.new_for_path(filePath);

                try {
                    file.delete(null);
                } catch (e) {
                    console.error(`Error deleting ${fileName}:`, e.message);
                }
            }
        } catch (e) {
            console.error('Error cleaning backgrounds directory:', e.message);
        }
    }

    copyWallpaper(sourcePath) {
        try {
            const bgDir = GLib.build_filenamev([this.themeDir, 'backgrounds']);
            const fileName = GLib.path_get_basename(sourcePath);
            const destPath = GLib.build_filenamev([bgDir, fileName]);

            const sourceFile = Gio.File.new_for_path(sourcePath);
            const destFile = Gio.File.new_for_path(destPath);

            sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);

            this.wallpaperPath = destPath;
            return destPath;
        } catch (e) {
            console.error('Error copying wallpaper:', e.message);
            return null;
        }
    }

    buildVariables(colorRoles) {
        const variables = {
            // Primary colors
            background: colorRoles['background'] || '#1e1e2e',
            foreground: colorRoles['foreground'] || '#cdd6f4',
            // ANSI colors 0-15
            color0: colorRoles['color0'] || '#45475a',
            color1: colorRoles['color1'] || '#f38ba8',
            color2: colorRoles['color2'] || '#a6e3a1',
            color3: colorRoles['color3'] || '#f9e2af',
            color4: colorRoles['color4'] || '#89b4fa',
            color5: colorRoles['color5'] || '#cba6f7',
            color6: colorRoles['color6'] || '#94e2d5',
            color7: colorRoles['color7'] || '#bac2de',
            color8: colorRoles['color8'] || '#585b70',
            color9: colorRoles['color9'] || '#f38ba8',
            color10: colorRoles['color10'] || '#a6e3a1',
            color11: colorRoles['color11'] || '#f9e2af',
            color12: colorRoles['color12'] || '#89b4fa',
            color13: colorRoles['color13'] || '#cba6f7',
            color14: colorRoles['color14'] || '#94e2d5',
            color15: colorRoles['color15'] || '#cdd6f4',
        };

        return variables;
    }

    processTemplates(variables) {
        const templatesDir = Gio.File.new_for_path(this.templatesDir);

        try {
            const enumerator = templatesDir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const fileName = fileInfo.get_name();
                const templatePath = GLib.build_filenamev([this.templatesDir, fileName]);
                const outputPath = GLib.build_filenamev([this.themeDir, fileName]);

                this.processTemplate(templatePath, outputPath, variables);
            }
        } catch (e) {
            console.error('Error processing templates:', e.message);
        }
    }

    processTemplate(templatePath, outputPath, variables) {
        try {
            const content = this.readFile(templatePath);
            let processed = content;

            // Replace all variables
            for (const [key, value] of Object.entries(variables)) {
                // Replace {key}
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                processed = processed.replace(regex, value);

                // Replace {key.strip} (removes # from hex colors)
                const stripRegex = new RegExp(`\\{${key}\\.strip\\}`, 'g');
                const strippedValue = typeof value === 'string' ? value.replace('#', '') : value;
                processed = processed.replace(stripRegex, strippedValue);

                // Replace {key.rgb} (converts hex to decimal RGB: r,g,b)
                const rgbRegex = new RegExp(`\\{${key}\\.rgb\\}`, 'g');
                if (typeof value === 'string' && value.startsWith('#')) {
                    const rgbValue = this.hexToRGB(value);
                    processed = processed.replace(rgbRegex, rgbValue);
                } else {
                    processed = processed.replace(rgbRegex, value);
                }
            }

            this.writeFile(outputPath, processed);
        } catch (e) {
            console.error(`Error processing template ${templatePath}:`, e.message);
        }
    }

    hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return '0,0,0';

        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);

        return `${r},${g},${b}`;
    }

    exportTheme(colorRoles, wallpaperPath, exportPath, themeName) {
        try {
            // Create export directory structure
            GLib.mkdir_with_parents(exportPath, 0o755);

            // Create backgrounds directory
            const bgDir = GLib.build_filenamev([exportPath, 'backgrounds']);
            GLib.mkdir_with_parents(bgDir, 0o755);

            // Copy wallpaper if available
            if (wallpaperPath) {
                const fileName = GLib.path_get_basename(wallpaperPath);
                const destPath = GLib.build_filenamev([bgDir, fileName]);

                const sourceFile = Gio.File.new_for_path(wallpaperPath);
                const destFile = Gio.File.new_for_path(destPath);

                sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
                console.log(`Copied wallpaper to: ${destPath}`);
            }

            // Build color variables
            const variables = this.buildVariables(colorRoles);

            // Process all templates to export directory
            this.processTemplatesToDirectory(variables, exportPath);

            console.log(`Theme exported successfully to: ${exportPath}`);
            return true;

        } catch (e) {
            console.error('Error exporting theme:', e.message);
            throw e;
        }
    }

    processTemplatesToDirectory(variables, exportPath) {
        const templatesDir = Gio.File.new_for_path(this.templatesDir);

        try {
            const enumerator = templatesDir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const fileName = fileInfo.get_name();
                const templatePath = GLib.build_filenamev([this.templatesDir, fileName]);
                const outputPath = GLib.build_filenamev([exportPath, fileName]);

                this.processTemplate(templatePath, outputPath, variables);
                console.log(`Processed template: ${fileName}`);
            }
        } catch (e) {
            console.error('Error processing templates for export:', e.message);
            throw e;
        }
    }

    applyOmarchyTheme() {
        try {
            GLib.spawn_command_line_async('omarchy-theme-set aether');
            console.log('Applied theme: aether');
        } catch (e) {
            console.error('Error applying omarchy theme:', e.message);
        }
    }

    // Utility methods
    readFile(path) {
        const file = Gio.File.new_for_path(path);
        const [success, contents] = file.load_contents(null);

        if (!success) {
            throw new Error(`Could not read file: ${path}`);
        }

        const decoder = new TextDecoder();
        return decoder.decode(contents);
    }

    writeFile(path, content) {
        const file = Gio.File.new_for_path(path);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);

        file.replace_contents(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
    }
}
