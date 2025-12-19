import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    ensureDirectoryExists,
    enumerateDirectory,
    copyFile,
    readFileAsText,
    writeTextToFile,
} from '../file-utils.js';

/**
 * VscodeThemeApplier - Handles VSCode extension installation and theming
 *
 * Installs the Aether theme as a VSCode extension by copying and processing
 * the vscode-extension template directory. Supports variable replacement
 * for dynamic theme generation.
 *
 * Features:
 * - Installs to ~/.vscode/extensions/theme-aether/
 * - Processes template files with variable substitution
 * - Recursive directory copying
 * - Handles package.json, themes/, and icon files
 *
 * Extension Structure:
 * ~/.vscode/extensions/theme-aether/
 * ├── package.json (metadata, activation events)
 * ├── themes/
 * │   └── aether-theme.json (color definitions)
 * └── icon.png (extension icon)
 *
 * @example
 * const applier = new VscodeThemeApplier('/path/to/templates');
 * applier.apply(variables);
 * // VSCode extension installed with processed variables
 */
export class VscodeThemeApplier {
    /**
     * Creates a new VscodeThemeApplier instance
     * @param {string} templatesDir - Path to templates directory
     */
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
        this.homeDir = GLib.get_home_dir();
        this.vscodeExtensionPath = GLib.build_filenamev([
            this.homeDir,
            '.vscode',
            'extensions',
            'theme-aether',
        ]);
    }

    /**
     * Applies VSCode theme by installing extension with processed variables
     * @param {Object} variables - Template variables (colors, wallpaper, etc.)
     * @returns {boolean} True if successful, false otherwise
     */
    apply(variables) {
        try {
            // Ensure the extension directory exists
            ensureDirectoryExists(this.vscodeExtensionPath);

            // Process the entire vscode-extension folder from templates
            const vscodeTemplateDir = GLib.build_filenamev([
                this.templatesDir,
                'vscode-extension',
            ]);

            // Validate template directory exists
            const templateDir = Gio.File.new_for_path(vscodeTemplateDir);
            if (!templateDir.query_exists(null)) {
                console.log('VSCode template directory not found, skipping');
                return false;
            }

            // Copy and process all files from vscode-extension template
            this._copyExtensionDirectory(
                vscodeTemplateDir,
                this.vscodeExtensionPath,
                variables
            );

            console.log(
                `VSCode theme extension installed to: ${this.vscodeExtensionPath}`
            );
            return true;
        } catch (e) {
            console.error('Error applying VSCode theme:', e.message);
            return false;
        }
    }

    /**
     * Recursively copies and processes VSCode extension directory
     * Applies variable substitution to all files
     * @param {string} sourceDir - Source directory path
     * @param {string} destDir - Destination directory path
     * @param {Object} variables - Template variables for substitution
     * @private
     */
    _copyExtensionDirectory(sourceDir, destDir, variables) {
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
                this._copyExtensionDirectory(
                    subSourceDir,
                    subDestDir,
                    variables
                );
            } else if (fileType === Gio.FileType.REGULAR) {
                // Process and copy file
                const destPath = GLib.build_filenamev([destDir, fileName]);
                this._processAndCopyFile(filePath, destPath, variables);
            }
        });
    }

    /**
     * Processes a template file with variable substitution and copies it
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @param {Object} variables - Template variables for substitution
     * @private
     */
    _processAndCopyFile(sourcePath, destPath, variables) {
        try {
            // Read source file
            let content = readFileAsText(sourcePath);

            if (!content) {
                console.error(`Failed to read ${sourcePath}`);
                return;
            }

            // Replace all variables in format {variable}
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                content = content.replace(regex, value);
            });

            // Write to destination
            writeTextToFile(destPath, content);
        } catch (e) {
            console.error(
                `Error processing VSCode file ${GLib.path_get_basename(sourcePath)}:`,
                e.message
            );
        }
    }

    /**
     * Removes VSCode theme extension
     * @returns {boolean} True if successful, false otherwise
     */
    clear() {
        try {
            const extensionDir = Gio.File.new_for_path(
                this.vscodeExtensionPath
            );
            if (extensionDir.query_exists(null)) {
                // Remove directory recursively
                this._removeDirectory(extensionDir);
                console.log('Removed VSCode theme extension');
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error clearing VSCode theme:', e.message);
            return false;
        }
    }

    /**
     * Recursively removes a directory and its contents
     * @param {Gio.File} directory - Directory to remove
     * @private
     */
    _removeDirectory(directory) {
        try {
            const enumerator = directory.enumerate_children(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null))) {
                const child = directory.get_child(fileInfo.get_name());
                const fileType = fileInfo.get_file_type();

                if (fileType === Gio.FileType.DIRECTORY) {
                    this._removeDirectory(child);
                } else {
                    child.delete(null);
                }
            }

            directory.delete(null);
        } catch (e) {
            console.error('Error removing directory:', e.message);
        }
    }
}
