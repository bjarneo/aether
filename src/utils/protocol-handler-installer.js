import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ensureDirectoryExists, writeTextToFile} from './file-utils.js';

/**
 * Utility for automatic protocol handler installation
 * Installs aether:// protocol handler on first run
 */
export class ProtocolHandlerInstaller {
    /**
     * Checks if protocol handler is already installed
     * @returns {boolean} True if installed, false otherwise
     */
    static isInstalled() {
        const flagPath = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            '.protocol-handler-installed',
        ]);
        const flagFile = Gio.File.new_for_path(flagPath);
        return flagFile.query_exists(null);
    }

    /**
     * Marks protocol handler as installed
     * @private
     */
    static _markInstalled() {
        const configDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
        ]);
        ensureDirectoryExists(configDir);

        const flagPath = GLib.build_filenamev([
            configDir,
            '.protocol-handler-installed',
        ]);
        const timestamp = new Date().toISOString();
        writeTextToFile(flagPath, `Installed on: ${timestamp}\n`);
    }

    /**
     * Installs the protocol handler automatically
     * @returns {boolean} True if installation succeeded, false otherwise
     */
    static install() {
        try {
            console.log('Installing aether:// protocol handler...');

            // 1. Create desktop file
            const desktopDir = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local',
                'share',
                'applications',
            ]);
            ensureDirectoryExists(desktopDir);

            const desktopPath = GLib.build_filenamev([
                desktopDir,
                'aether-protocol-handler.desktop',
            ]);

            const desktopContent = `[Desktop Entry]
Name=Aether Protocol Handler
Comment=Import Aether blueprint themes from web links
Exec=aether --import-blueprint %u --auto-apply
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/aether;
Icon=preferences-desktop-theme
Categories=System;Utility;
Keywords=theme;blueprint;import;
StartupNotify=false
Terminal=false
`;

            writeTextToFile(desktopPath, desktopContent);
            console.log(`✓ Created desktop file: ${desktopPath}`);

            // 2. Make desktop file executable
            const desktopFile = Gio.File.new_for_path(desktopPath);
            desktopFile.set_attribute_uint32(
                'unix::mode',
                0o755,
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            // 3. Update desktop database
            try {
                const [success, stdout, stderr, exitStatus] =
                    GLib.spawn_command_line_sync(
                        `update-desktop-database ${desktopDir}`
                    );
                if (success && exitStatus === 0) {
                    console.log('✓ Updated desktop database');
                }
            } catch (error) {
                // Non-critical if update-desktop-database is not available
                console.log(
                    '⚠ Could not update desktop database (non-critical)'
                );
            }

            // 4. Register as default handler for aether:// protocol
            try {
                const [success, stdout, stderr, exitStatus] =
                    GLib.spawn_command_line_sync(
                        'xdg-mime default aether-protocol-handler.desktop x-scheme-handler/aether'
                    );
                if (success && exitStatus === 0) {
                    console.log('✓ Registered aether:// protocol handler');
                } else {
                    console.error('Failed to register protocol handler');
                    return false;
                }
            } catch (error) {
                console.error(
                    `Failed to register protocol handler: ${error.message}`
                );
                return false;
            }

            // 5. Mark as installed
            this._markInstalled();

            console.log('✓ Protocol handler installation complete!');
            console.log(
                '  You can now import blueprints from websites using aether:// links'
            );

            return true;
        } catch (error) {
            console.error(
                `Protocol handler installation failed: ${error.message}`
            );
            return false;
        }
    }

    /**
     * Installs protocol handler if not already installed
     * @returns {boolean} True if handler is available (already installed or newly installed)
     */
    static ensureInstalled() {
        if (this.isInstalled()) {
            return true;
        }

        console.log('First run detected - installing protocol handler...');
        return this.install();
    }

    /**
     * Forces reinstallation of protocol handler
     * @returns {boolean} True if installation succeeded
     */
    static reinstall() {
        // Remove flag to force reinstall
        const flagPath = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            '.protocol-handler-installed',
        ]);
        const flagFile = Gio.File.new_for_path(flagPath);
        if (flagFile.query_exists(null)) {
            flagFile.delete(null);
        }

        return this.install();
    }
}
