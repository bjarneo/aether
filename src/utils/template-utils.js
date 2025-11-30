import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {enumerateDirectory, fileExists, loadJsonFile} from './file-utils.js';

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
        GLib.path_get_dirname(GLib.path_get_dirname(thisFilePath))
    );

    return GLib.build_filenamev([projectDir, 'templates']);
}

/**
 * Gets the path to the user's custom templates directory
 * @returns {string} Path to user templates directory (~/.config/aether/custom)
 */
export function getUserTemplatesDir() {
    return GLib.build_filenamev([
        GLib.get_user_config_dir(),
        'aether',
        'custom',
    ]);
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
            // Skip directories (like vscode-extension/)
            if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                return;
            }
            templates.set(fileName, filePath);
        });
    }

    // 2. Add user overrides (overwriting defaults)
    // Skip directories - they are custom app folders handled by getCustomApps()
    if (fileExists(userDir)) {
        enumerateDirectory(userDir, (fileInfo, filePath, fileName) => {
            if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                return;
            }
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

/**
 * Gets a list of custom apps from ~/.config/aether/custom/
 * Each app folder should contain a config.json with template and destination
 * @returns {Array<{name: string, label: string, templatePath: string}>}
 */
export function getCustomApps() {
    const apps = [];
    const appsDir = GLib.build_filenamev([
        GLib.get_user_config_dir(),
        'aether',
        'custom',
    ]);

    if (!fileExists(appsDir)) {
        return apps;
    }

    try {
        const dir = Gio.File.new_for_path(appsDir);
        const enumerator = dir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            // Only process directories
            if (fileInfo.get_file_type() !== Gio.FileType.DIRECTORY) {
                continue;
            }

            const appName = fileInfo.get_name();
            const appPath = GLib.build_filenamev([appsDir, appName]);
            const configPath = GLib.build_filenamev([appPath, 'config.json']);

            if (!fileExists(configPath)) {
                continue;
            }

            const config = loadJsonFile(configPath, null);
            if (!config || !config.template) {
                continue;
            }

            const templatePath = GLib.build_filenamev([
                appPath,
                config.template,
            ]);
            if (!fileExists(templatePath)) {
                continue;
            }

            apps.push({
                name: appName,
                label: appName.charAt(0).toUpperCase() + appName.slice(1),
                templatePath: templatePath,
            });
        }

        enumerator.close(null);
    } catch (e) {
        console.error('Error reading apps directory:', e.message);
    }

    return apps;
}
