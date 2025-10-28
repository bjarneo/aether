import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Command handler for installing keyboard shortcut
 */
export class InstallMenuCommand {
    /**
     * Executes the install-menu command
     */
    static execute() {
        const hyprConfigDir = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.config',
            'hypr',
        ]);

        const hyprConfig = GLib.build_filenamev([
            hyprConfigDir,
            'bindings.conf',
        ]);

        const comment = '# Aether blueprint menu launcher';
        const bindLine = `bind = SUPERALTCTRL, space, exec, aether -m`;

        // Check if bindings.conf exists
        const configFile = Gio.File.new_for_path(hyprConfig);
        const configDir = Gio.File.new_for_path(hyprConfigDir);

        // Create directory if it doesn't exist
        if (!configDir.query_exists(null)) {
            configDir.make_directory_with_parents(null);
        }

        // Read existing content and check if binding exists
        let existingContent = '';
        if (configFile.query_exists(null)) {
            try {
                const [, contents] = configFile.load_contents(null);
                const text = new TextDecoder().decode(contents);

                // Check if it exists with correct format (combined modifiers)
                if (
                    text.includes('aether -m') &&
                    (text.includes('SUPERALTCTRL') ||
                        text.includes('SUPER, ALT, CTRL'))
                ) {
                    print(
                        'Aether menu binding already exists in bindings.conf'
                    );
                    return;
                }

                // Mapping exists but with wrong format - remove it and re-add
                if (text.includes('aether -m')) {
                    // Remove old binding lines
                    const lines = text.split('\n');
                    const filteredLines = lines.filter(
                        line =>
                            !line.includes('Aether blueprint menu launcher') &&
                            !line.includes('aether -m')
                    );
                    existingContent = filteredLines.join('\n');
                    if (!existingContent.endsWith('\n')) {
                        existingContent += '\n';
                    }
                } else {
                    // No binding exists, use original content
                    existingContent = text;
                    if (!existingContent.endsWith('\n')) {
                        existingContent += '\n';
                    }
                }
            } catch (e) {
                // Ignore read errors, will create new content
                existingContent = '';
            }
        }

        // Add the binding
        const newContent = existingContent + comment + '\n' + bindLine + '\n';

        try {
            // Convert string to bytes - GJS replace_contents expects Uint8Array directly
            const encoder = new TextEncoder();
            const bytes = encoder.encode(newContent);

            const [success] = configFile.replace_contents(
                bytes,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            if (!success) {
                throw new Error('Replace operation failed');
            }

            print('Added Aether menu binding to bindings.conf');
            print('Keybinding: SUPERALTCTRL + space');
            print('To apply changes, reload Hyprland: hyprctl reload');
        } catch (e) {
            print(`Error: Failed to write to bindings.conf: ${e.message}`);
        }
    }
}
