import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { enumerateDirectory, fileExists } from './file-utils.js';

/**
 * Gets the path to the default project templates directory
 * @returns {string} Path to templates directory
 */
export function getProjectTemplatesDir() {
    const thisFilePath = Gio.File.new_for_path(
        import.meta.url.replace('file://', '')
    ).get_path();
    
    // src/utils/template-utils.js -> src/utils -> src -> root
    const projectDir = GLib.path_get_dirname(
        GLib.path_get_dirname(
            GLib.path_get_dirname(thisFilePath)
        )
    );
    
    return GLib.build_filenamev([projectDir, 'templates']);
}

/**
 * Gets the path to the user's custom templates directory
 * @returns {string} Path to user templates directory (~/aether-templates)
 */
export function getUserTemplatesDir() {
    return GLib.build_filenamev([GLib.get_home_dir(), 'aether-templates']);
}

/**
 * Gets a map of all available templates, prioritizing user overrides
 * @returns {Map<string, string>} Map of fileName -> fullPath
 */
export function getTemplateMap() {
    const templates = new Map();
    const projectDir = getProjectTemplatesDir();
    const userDir = getUserTemplatesDir();

    // 1. Add default templates
    if (fileExists(projectDir)) {
        enumerateDirectory(projectDir, (fileInfo, filePath, fileName) => {
             templates.set(fileName, filePath);
        });
    }

    // 2. Add user overrides (overwriting defaults)
    if (fileExists(userDir)) {
         enumerateDirectory(userDir, (fileInfo, filePath, fileName) => {
             templates.set(fileName, filePath);
         });
    }

    return templates;
}

/**
 * Resolves the path for a specific template file
 * Checks user directory first, then default directory
 * @param {string} fileName - Name of the template file
 * @returns {string} Full path to the template file
 */
export function resolveTemplatePath(fileName) {
    const userDir = getUserTemplatesDir();
    const userPath = GLib.build_filenamev([userDir, fileName]);

    if (fileExists(userPath)) {
        return userPath;
    }

    const projectDir = getProjectTemplatesDir();
    return GLib.build_filenamev([projectDir, fileName]);
}

