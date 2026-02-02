/**
 * AetherApplication - Main application class for Aether
 *
 * Handles:
 * - Application lifecycle and window management
 * - Command-line argument processing
 * - CLI commands (list-blueprints, apply-blueprint, generate, import)
 * - Theme manager initialization
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
    ImportColorsTomlCommand,
} from './cli/index.js';
import {themeState} from './state/ThemeState.js';
import {blueprintService} from './services/BlueprintService.js';
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
                'import-base16',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Import a Base16 color scheme from YAML file',
                'FILE'
            );

            this.add_main_option(
                'import-colors-toml',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Import a colors.toml color scheme file',
                'FILE'
            );

            this.add_main_option(
                'no-apply',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.NONE,
                'Generate templates without applying theme (use with --generate)',
                null
            );

            this.add_main_option(
                'output',
                'o'.charCodeAt(0),
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING,
                'Output directory for generated theme files (use with --generate --no-apply)',
                'PATH'
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
            if (this._handleImportColorsToml(options)) return 0;
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
            if (!options.contains('generate')) return false;

            const wallpaperPath = this._getStringOption(options, 'generate');
            const extractionMode = this._getStringOption(options, 'extract-mode') || 'normal';
            const lightMode = options.contains('light-mode');
            // GLib normalizes hyphens to underscores in option names
            const noApply = options.contains('no-apply') || options.contains('no_apply');
            const outputPath = this._getStringOption(options, 'output');

            this._runAsyncCommand(
                GenerateThemeCommand.execute(wallpaperPath, extractionMode, lightMode, {noApply, outputPath})
            );

            return true;
        }

        /**
         * Handle --import-blueprint command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleImportBlueprint(options) {
            if (!options.contains('import-blueprint')) return false;

            let source = this._getStringOption(options, 'import-blueprint');

            // Parse aether:// protocol URLs
            if (source.startsWith('aether://import?url=')) {
                const urlParam = source.substring('aether://import?url='.length);
                source = decodeURIComponent(urlParam);
                print(`Parsed protocol URL: ${source}`);
            }

            const autoApply = options.contains('auto-apply');

            this._runAsyncCommand(
                ImportBlueprintCommand.execute(source, autoApply).then(async success => {
                    if (success) {
                        await this._updateGuiAfterImport();
                    }
                    return success;
                })
            );

            return true;
        }

        /**
         * Handle --import-base16 command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleImportBase16(options) {
            if (!options.contains('import-base16')) return false;

            const filePath = this._getStringOption(options, 'import-base16');
            const wallpaperPath = this._getStringOption(options, 'wallpaper');
            const lightMode = options.contains('light-mode');

            this._runAsyncCommand(
                ImportBase16Command.execute(filePath, {wallpaperPath, lightMode})
            );

            return true;
        }

        /**
         * Handle --import-colors-toml command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleImportColorsToml(options) {
            if (!options.contains('import-colors-toml')) return false;

            const filePath = this._getStringOption(options, 'import-colors-toml');
            const wallpaperPath = this._getStringOption(options, 'wallpaper');
            const lightMode = options.contains('light-mode');

            this._runAsyncCommand(
                ImportColorsTomlCommand.execute(filePath, {wallpaperPath, lightMode})
            );

            return true;
        }

        /**
         * Handle --widget-blueprint command
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @returns {boolean} True if handled
         */
        _handleWidgetMode(options) {
            if (!options.contains('widget-blueprint')) return false;

            this._launchWidget();
            return true;
        }

        /**
         * Get a string option value from command line options
         * @private
         * @param {GLib.VariantDict} options - Command options
         * @param {string} name - Option name
         * @returns {string|null} Option value or null if not present
         */
        _getStringOption(options, name) {
            if (!options.contains(name)) return null;

            return options
                .lookup_value(name, GLib.VariantType.new('s'))
                .get_string()[0];
        }

        /**
         * Run an async command with proper hold/release and error handling
         * @private
         * @param {Promise<boolean>} promise - Command promise
         */
        _runAsyncCommand(promise) {
            this.hold();
            promise
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
         * Update GUI state after CLI import
         * Loads the imported blueprint into themeState so the editor updates
         * @private
         */
        async _updateGuiAfterImport() {
            try {
                // Find the most recently imported blueprint (highest timestamp)
                const allBlueprints = blueprintService.loadAll();
                if (allBlueprints.length === 0) {
                    return;
                }

                // Sort by timestamp descending and get the newest
                allBlueprints.sort(
                    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
                );
                const blueprint = allBlueprints[0];

                // Handle wallpaper URL - download if not already local
                if (blueprint.palette?.wallpaperUrl && !blueprint.palette?.wallpaper) {
                    const wallpaperPath = await this._downloadWallpaperForBlueprint(
                        blueprint.palette.wallpaperUrl
                    );
                    if (wallpaperPath) {
                        blueprint.palette.wallpaper = wallpaperPath;
                    }
                }

                themeState.fromBlueprint(blueprint);

                // Activate window and switch to editor view
                this.activate();

                // Switch to editor tab after a small delay to ensure window is ready
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    const window = this.active_window;
                    if (window) {
                        // Switch to editor view
                        if (window._viewStack) {
                            window._viewStack.set_visible_child_name('editor');
                        }
                        // Switch to custom tab in the editor
                        if (window.paletteGenerator) {
                            window.paletteGenerator.switchToCustomTab();
                        }
                    }
                    return GLib.SOURCE_REMOVE;
                });
            } catch (e) {
                console.error(`Error updating GUI after import: ${e.message}`);
            }
        }

        /**
         * Download wallpaper from URL for blueprint import
         * @param {string} url - Wallpaper URL
         * @returns {Promise<string|null>} Local path or null on failure
         * @private
         */
        async _downloadWallpaperForBlueprint(url) {
            try {
                const {ensureDirectoryExists} = await import('./utils/file-utils.js');
                const Soup = (await import('gi://Soup?version=3.0')).default;

                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);
                ensureDirectoryExists(wallpapersDir);

                // Extract filename from URL
                const urlParts = url.split('/');
                const filename = urlParts[urlParts.length - 1] || 'imported-wallpaper.jpg';
                const wallpaperPath = GLib.build_filenamev([wallpapersDir, filename]);

                // Check if already downloaded
                if (GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS)) {
                    return wallpaperPath;
                }

                console.log(`Downloading wallpaper from: ${url}`);

                // Download the wallpaper
                return new Promise((resolve, reject) => {
                    const session = new Soup.Session();
                    const message = Soup.Message.new('GET', url);

                    if (!message) {
                        reject(new Error(`Invalid URL: ${url}`));
                        return;
                    }

                    session.send_and_read_async(
                        message,
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (session, result) => {
                            try {
                                const bytes = session.send_and_read_finish(result);
                                const status = message.get_status();

                                if (status !== 200) {
                                    console.error(`Failed to download wallpaper: HTTP ${status}`);
                                    resolve(null);
                                    return;
                                }

                                const data = bytes.get_data();
                                if (!data || data.length === 0) {
                                    console.error('Empty response when downloading wallpaper');
                                    resolve(null);
                                    return;
                                }

                                // Write to file
                                const file = Gio.File.new_for_path(wallpaperPath);
                                const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                                stream.write_bytes(bytes, null);
                                stream.close(null);

                                console.log(`Wallpaper saved to: ${wallpaperPath}`);
                                resolve(wallpaperPath);
                            } catch (error) {
                                console.error(`Error saving wallpaper: ${error.message}`);
                                resolve(null);
                            }
                        }
                    );
                });
            } catch (error) {
                console.error(`Error downloading wallpaper: ${error.message}`);
                return null;
            }
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
