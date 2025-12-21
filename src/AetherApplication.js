/**
 * AetherApplication - Main application class for Aether
 *
 * Handles:
 * - Application lifecycle and window management
 * - Command-line argument processing
 * - CLI commands (list-blueprints, apply-blueprint, generate, import)
 * - Theme manager initialization
 * - Shader installation
 * - Protocol handler registration
 *
 * @module AetherApplication
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw?version=1';

import {AetherWindow} from './AetherWindow.js';
import {ThemeManager} from './services/theme-manager.js';
import {ensureDirectoryExists} from './utils/file-utils.js';
import {
    ListBlueprintsCommand,
    ApplyBlueprintCommand,
    GenerateThemeCommand,
    ImportBlueprintCommand,
    ImportBase16Command,
    CheckScheduleCommand,
} from './cli/index.js';
import {BlueprintWidget} from './components/BlueprintWidget.js';
import {runMigrations} from './utils/migrations.js';
import {ProtocolHandlerInstaller} from './utils/protocol-handler-installer.js';
import {AboutDialog} from './components/AboutDialog.js';

// Theme manager singleton (initialized only when GUI is needed)
let themeManager = null;

/**
 * AetherApplication - Main application class with CLI support
 * @class
 * @extends {Adw.Application}
 */
export const AetherApplication = GObject.registerClass(
    class AetherApplication extends Adw.Application {
        /**
         * Initialize application with ID and CLI flags
         * @private
         */
        _init() {
            super._init({
                application_id: 'li.oever.aether',
                flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
            });
            this._wallpaperPath = null;

            // Ensure ~/Wallpapers directory exists
            const wallpapersDir = GLib.build_filenamev([
                GLib.get_home_dir(),
                'Wallpapers',
            ]);
            ensureDirectoryExists(wallpapersDir);

            this._setupCommandLineOptions();
        }

        /**
         * Set up all command line options
         * @private
         */
        _setupCommandLineOptions() {
            this.add_main_option(
                'wallpaper',
                'w'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Path to wallpaper image to load on startup',
                'FILE'
            );

            this.add_main_option(
                'list-blueprints',
                'l'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'List all saved blueprint themes',
                null
            );

            this.add_main_option(
                'apply-blueprint',
                'a'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Apply a blueprint by name',
                'NAME'
            );

            this.add_main_option(
                'generate',
                'g'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Extract colors from wallpaper and apply theme',
                'FILE'
            );

            this.add_main_option(
                'extract-mode',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Extraction mode: normal (default), monochromatic, analogous, pastel, material, colorful, muted, bright',
                'MODE'
            );

            this.add_main_option(
                'light-mode',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'Generate light mode theme (for --generate)',
                null
            );

            this.add_main_option(
                'widget-blueprint',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'Show floating blueprint selector widget',
                null
            );

            this.add_main_option(
                'import-blueprint',
                'i'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Import a blueprint from URL or file path',
                'URL|PATH'
            );

            this.add_main_option(
                'auto-apply',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'Automatically apply imported blueprint (use with --import-blueprint)',
                null
            );

            this.add_main_option(
                'check-schedule',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'Check and apply scheduled theme changes (used by scheduler daemon)',
                null
            );

            this.add_main_option(
                'import-base16',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Import a Base16 color scheme from YAML file',
                'FILE'
            );
        }

        /**
         * Handle command-line arguments
         * @param {Gio.ApplicationCommandLine} commandLine - Command line instance
         * @returns {number} Exit code (0 for success)
         * @override
         */
        vfunc_command_line(commandLine) {
            const options = commandLine.get_options_dict();

            // Run migrations before any command execution
            runMigrations();

            // Handle CLI commands
            if (this._handleListBlueprints(options)) return 0;
            if (this._handleApplyBlueprint(options)) return 0;
            if (this._handleGenerate(options)) return 0;
            if (this._handleImportBlueprint(options)) return 0;
            if (this._handleImportBase16(options)) return 0;
            if (this._handleCheckSchedule(options)) return 0;
            if (this._handleWidgetMode(options)) return 0;

            // Handle wallpaper option for GUI mode
            this._handleWallpaperOption(options);

            this.activate();
            return 0;
        }

        /**
         * Handle --list-blueprints command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleListBlueprints(options) {
            if (options.contains('list-blueprints')) {
                ListBlueprintsCommand.execute();
                return true;
            }
            return false;
        }

        /**
         * Handle --apply-blueprint command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleApplyBlueprint(options) {
            if (options.contains('apply-blueprint')) {
                const blueprintName = options
                    .lookup_value('apply-blueprint', GLib.VariantType.new('s'))
                    .get_string()[0];
                ApplyBlueprintCommand.execute(blueprintName);
                return true;
            }
            return false;
        }

        /**
         * Handle --generate command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleGenerate(options) {
            if (options.contains('generate')) {
                const wallpaperPath = options
                    .lookup_value('generate', GLib.VariantType.new('s'))
                    .get_string()[0];

                let extractionMode = 'normal';
                if (options.contains('extract-mode')) {
                    extractionMode = options
                        .lookup_value('extract-mode', GLib.VariantType.new('s'))
                        .get_string()[0];
                }

                const lightMode = options.contains('light-mode');

                this.hold();
                GenerateThemeCommand.execute(
                    wallpaperPath,
                    extractionMode,
                    lightMode
                )
                    .then(success => {
                        this.release();
                        if (!success) {
                            imports.system.exit(1);
                        }
                    })
                    .catch(error => {
                        printerr(`Error: ${error.message}`);
                        this.release();
                        imports.system.exit(1);
                    });

                return true;
            }
            return false;
        }

        /**
         * Handle --import-blueprint command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleImportBlueprint(options) {
            if (options.contains('import-blueprint')) {
                let source = options
                    .lookup_value('import-blueprint', GLib.VariantType.new('s'))
                    .get_string()[0];

                // Parse aether:// protocol URLs
                if (source.startsWith('aether://import?url=')) {
                    const urlParam = source.substring(
                        'aether://import?url='.length
                    );
                    source = decodeURIComponent(urlParam);
                    print(`Parsed protocol URL: ${source}`);
                }

                const autoApply = options.contains('auto-apply');

                this.hold();
                ImportBlueprintCommand.execute(source, autoApply)
                    .then(success => {
                        this.release();
                        if (!success) {
                            imports.system.exit(1);
                        }
                    })
                    .catch(error => {
                        printerr(`Error: ${error.message}`);
                        this.release();
                        imports.system.exit(1);
                    });

                return true;
            }
            return false;
        }

        /**
         * Handle --import-base16 command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleImportBase16(options) {
            if (options.contains('import-base16')) {
                const filePath = options
                    .lookup_value('import-base16', GLib.VariantType.new('s'))
                    .get_string()[0];

                // Check for optional wallpaper
                let wallpaperPath = null;
                if (options.contains('wallpaper')) {
                    wallpaperPath = options
                        .lookup_value('wallpaper', GLib.VariantType.new('s'))
                        .get_string()[0];
                }

                const lightMode = options.contains('light-mode');

                this.hold();
                ImportBase16Command.execute(filePath, {wallpaperPath, lightMode})
                    .then(success => {
                        this.release();
                        if (!success) {
                            imports.system.exit(1);
                        }
                    })
                    .catch(error => {
                        printerr(`Error: ${error.message}`);
                        this.release();
                        imports.system.exit(1);
                    });

                return true;
            }
            return false;
        }

        /**
         * Handle --check-schedule command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleCheckSchedule(options) {
            if (options.contains('check-schedule')) {
                this.hold();
                CheckScheduleCommand.execute()
                    .then(() => {
                        this.release();
                    })
                    .catch(error => {
                        printerr(`Error: ${error.message}`);
                        this.release();
                    });
                return true;
            }
            return false;
        }

        /**
         * Handle --widget-blueprint command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleWidgetMode(options) {
            if (options.contains('widget-blueprint')) {
                this._launchWidget();
                return true;
            }
            return false;
        }

        /**
         * Handle --wallpaper option for GUI mode
         * @private
         * @param {GLib.VariantDict} options - Command options
         */
        _handleWallpaperOption(options) {
            if (options.contains('wallpaper')) {
                const wallpaperPath = options
                    .lookup_value('wallpaper', GLib.VariantType.new('s'))
                    .get_string()[0];

                const file = Gio.File.new_for_path(wallpaperPath);
                if (file.query_exists(null)) {
                    this._wallpaperPath = wallpaperPath;
                } else {
                    printerr(
                        `Error: Wallpaper file not found: ${wallpaperPath}`
                    );
                }
            }
        }

        /**
         * Launch floating blueprint widget
         * @private
         */
        _launchWidget() {
            // Initialize theme manager for consistent styling
            if (!themeManager) {
                themeManager = new ThemeManager();
            }
            this.themeManager = themeManager;

            // Create and show blueprint widget
            const widget = new BlueprintWidget(this);

            widget.connect('blueprint-selected', (_, blueprint) => {
                console.log(`Applying blueprint: ${blueprint.name}`);
                ApplyBlueprintCommand.execute(blueprint.name);
                this.quit();
            });

            widget.connect('close-request', () => {
                this.quit();
                return false;
            });

            widget.present();
        }

        /**
         * Activate application and create main window
         * @override
         */
        vfunc_activate() {
            // Run migrations on first activation
            if (!this.active_window) {
                runMigrations();
            }

            // Initialize theme manager only when GUI is activated
            if (!themeManager) {
                themeManager = new ThemeManager();
                console.log(`Base theme: ${themeManager.getThemePath()}`);
                console.log(
                    `Override theme: ${themeManager.getOverridePath()} (edit this file)`
                );
            }
            this.themeManager = themeManager;

            // Install protocol handler on first run
            ProtocolHandlerInstaller.ensureInstalled();

            // Install shaders only when GUI is activated
            this._installShaders();

            let window = this.active_window;
            if (!window) {
                window = new AetherWindow(this);

                // Set up application actions
                this._setupActions(window);

                // Load wallpaper if provided via CLI
                if (this._wallpaperPath) {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        window.loadWallpaperFromCLI(this._wallpaperPath);
                        this._wallpaperPath = null;
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
            window.present();
        }

        /**
         * Install Aether shaders to hyprshade directory
         * @private
         */
        _installShaders() {
            try {
                // Get shader source directory (in Aether repo)
                const appDir = GLib.path_get_dirname(
                    GLib.path_get_dirname(
                        Gio.File.new_for_path(
                            import.meta.url.replace('file://', '')
                        ).get_path()
                    )
                );
                const shaderSource = GLib.build_filenamev([appDir, 'shaders']);

                // Get shader target directory (hyprshade location)
                const shaderTarget = GLib.build_filenamev([
                    GLib.get_user_config_dir(),
                    'hypr',
                    'shaders',
                ]);

                ensureDirectoryExists(shaderTarget);

                const sourceDir = Gio.File.new_for_path(shaderSource);
                if (!sourceDir.query_exists(null)) {
                    console.log(
                        'Shader source directory not found, skipping installation'
                    );
                    return;
                }

                const enumerator = sourceDir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                let installedCount = 0;
                while ((info = enumerator.next_file(null)) !== null) {
                    const name = info.get_name();
                    if (name.endsWith('.glsl')) {
                        const sourcePath = GLib.build_filenamev([
                            shaderSource,
                            name,
                        ]);
                        const targetPath = GLib.build_filenamev([
                            shaderTarget,
                            name,
                        ]);

                        const targetFile = Gio.File.new_for_path(targetPath);
                        if (!targetFile.query_exists(null)) {
                            targetFile.make_symbolic_link(sourcePath, null);
                            installedCount++;
                        }
                    }
                }

                console.log(
                    `Installed ${installedCount} Aether shaders to ${shaderTarget}`
                );
            } catch (error) {
                console.error('Error installing shaders:', error);
            }
        }

        /**
         * Set up application actions
         * @private
         * @param {AetherWindow} window - Main window
         */
        _setupActions(window) {
            const aboutAction = new Gio.SimpleAction({name: 'about'});
            aboutAction.connect('activate', () => {
                AboutDialog.show(window);
            });
            this.add_action(aboutAction);
        }

        /**
         * Clean up on shutdown
         * @override
         */
        vfunc_shutdown() {
            if (this.themeManager) {
                this.themeManager.destroy();
            }
            super.vfunc_shutdown();
        }
    }
);
